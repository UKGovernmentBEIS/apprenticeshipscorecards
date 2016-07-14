using System;
using System.Linq;
using System.Text.RegularExpressions;
using System.Net;
using System.IO;
using Newtonsoft.Json.Linq;
using System.Web.Script.Serialization;

namespace ScorecardMerge2.Mediators
{
    public class ApprenticeshipMediator
    {
        private readonly Uri _apiUrl;
        private readonly Uri _postCodesApiUrl;
        private readonly Uri _geocodeUrl;
        public ApprenticeshipMediator(string apiURL, string postCodesApiUrl, string geocodeUrl)
        {
            _apiUrl = new Uri(apiURL);
            _postCodesApiUrl = new Uri(postCodesApiUrl);
            _geocodeUrl = new Uri(geocodeUrl);
        }
        
        public object RetrieveProvidersJson(int page, string sortby, string subjectcode, string search, string postcode, int? distance)
        {
            string effectiveSubjectCode = String.IsNullOrEmpty(subjectcode) ? "0" : subjectcode;
            string sortByField;
            bool reverse;
            string additionalFilter = "";
            if (sortby == "name")
            {
                sortByField = "provider.name";
                reverse = false;
            }
            else if (sortby == "distance")
            {
                sortByField = "distance";
                reverse = false;
            }
            else if (sortby == "earnings" || string.IsNullOrEmpty(sortby))
            {
                sortByField = "earnings.median";
                reverse = true;
                additionalFilter = " and earnings.median>-1";
            }
            else if (sortby == "satisfaction")
            {
                sortByField = "learner_stats.satisfaction";
                reverse = true;
                additionalFilter = " and learner_stats.satisfaction>-1";
            } else if (sortby == "passrate")
            {
                sortByField = "stats.success_rate";
                reverse = true;
                additionalFilter = " and stats.success_rate>-1";
            }
            else
            {
                throw new NotImplementedException();
            }

            
            var locationFound = false;
            string locationName = null;
            string locationAppendix = "";

            if (!String.IsNullOrEmpty(postcode) && distance.HasValue)
            {
                locationAppendix = GetLocationQueryAppendix(postcode, distance.Value, out locationName);
                if (!string.IsNullOrEmpty(locationAppendix))
                {
                    locationFound = true;
                } else if (sortByField == "distance")
                {
                    sortByField = "earnings.median";
                    reverse = true;
                }
            }

            var endpoint = String.IsNullOrEmpty(search)
                ? string.Format("apprenticeships/search?page_size=20&page_number={0}&sort_by={1}&reverse={2}&query=subject_tier_2_code={3}{4}", page, sortByField, reverse? "true" : "false" , effectiveSubjectCode, additionalFilter)
                : string.Format("apprenticeships/search?page_size=20&phrase={0}&page_number={1}&sort_by={2}&reverse={3}&query=subject_tier_2_code={4}{5}", search, page, sortByField, reverse ? "true" : "false", effectiveSubjectCode, additionalFilter);

            endpoint = endpoint + locationAppendix;

            var jsonString = RequestJson(endpoint);

            var ships = JObject.Parse(jsonString);
            var end = false;
            if (ships["results"].Count() == 0 || (int)ships["page_number"] < page)
            {
                // we reached the end of the data set - don't append duplicates.
                return new {
                    apprenticeships = new {
                        results = new object[0],
                        totalcount = (int)ships["total_results"],
                        locationname = locationFound ? locationName : null},
                    end = true,
                    location = locationFound };
            }

            if ((int)ships["items_per_page"] > ships["results"].Count())
            {
                // reached the end of the data set - don't show loading indicator anymore
                end = true;
            }

            var res = new JObject();
            res["apprenticeships"] = new JObject();
            res["apprenticeships"]["results"] = ships["results"];
            res["apprenticeships"]["totalcount"] = ships["total_results"];
            if (locationFound) { res["apprenticeships"]["locationname"] = locationName; }
            res["end"] = end;
            res["location"] = locationFound;
            
            return new JavaScriptSerializer().DeserializeObject(res.ToString());
        }

        private string GetLocationQueryAppendix(string postcode, int distance, out string locationName)
        {
            double latitude, longitude;
            locationName = ResolveAddress(postcode, out latitude, out longitude);
            if (!double.IsNaN(latitude) && !double.IsNaN(longitude))
            {
                return String.Format("&lon={0}&lat={1}&dist={2}",
                    longitude, latitude, distance);               
            }
            else
            {
                return "";
            }

        }

        private string ResolveAddress(string postcode, out double latitude, out double longitude)
        {

            var endpoint = string.Format("{0}address={1}", _geocodeUrl, postcode);
            var request = (HttpWebRequest) WebRequest.Create(endpoint);
            request.Method = "GET";
            request.Accept = "text/json";

            try
            {
                using (var res = (HttpWebResponse)request.GetResponse())
                {
                    using (var reader = new StreamReader(res.GetResponseStream()))
                    {
                        var json = reader.ReadToEnd();
                        var result = JObject.Parse(json);
                        var match = result["results"][0]["geometry"]["location"];
                        longitude = (double) match["lng"];
                        latitude = (double)match["lat"];
                        return (string) result["results"][0]["formatted_address"];
                    }
                }
            }
            catch
            {
                longitude = double.NaN;
                latitude = double.NaN;
                return null;
            }
        }



        private void ResolveAddress2(string postcode, out double latitude, out double longitude)
        {
            HttpWebRequest request = (HttpWebRequest)WebRequest.Create(string.Format("{0}postcodes?query={1}&limit=1", _postCodesApiUrl, postcode))   ;
            request.Method = "GET";
            request.Accept = "text/json";
            string res;
            try
            {
                using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
                {
                    using (StreamReader reader = new StreamReader(response.GetResponseStream()))
                    {
                        res = reader.ReadToEnd();

                        var candidateLongitude = Regex.Match(res, @"""longitude"":([\.\-0123456789]+)");
                        longitude = candidateLongitude.Success
                            ? double.Parse(candidateLongitude.Groups[1].Value)
                            : double.NaN;

                        var candidateLatitude = Regex.Match(res, @"""latitude"":([\.\-0123456789]+)");
                        latitude = candidateLatitude.Success
                            ? double.Parse(candidateLatitude.Groups[1].Value)
                            : double.NaN;
                        return;
                    }
                }
            }
            catch
            {
                longitude = double.NaN;
                latitude = double.NaN;
                return;
            }
        }

        public object RetrieveProviderDetail(int ukprn, string primarySubject)
        {
            var sanitisedPrimary = string.IsNullOrEmpty(primarySubject) ? "0" : primarySubject;
            var apprenticeshipsJson = string.Format("apprenticeships?query=provider_id={0}", ukprn);
            var ships = JObject.Parse(RequestJson(apprenticeshipsJson));
            if (ships["results"].Count() == 0) {
                return new { };
            }
            var provider = ships["results"][0]["provider"].DeepClone();
            provider["apprenticeships"] = ships["results"];
            provider["primary"] = ships["results"].First(x => (string)x["subject_tier_2_code"] == sanitisedPrimary);
            return new JavaScriptSerializer().DeserializeObject(provider.ToString());
        }
        
        private string RequestJson(string endpoint)
        {
            HttpWebRequest request = (HttpWebRequest)WebRequest.Create(_apiUrl + endpoint);
            request.Method = "GET";
            request.Accept = "text/json";
            //request.KeepAlive = false;
            //request.ProtocolVersion = HttpVersion.Version10;

            using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
            {
                using (StreamReader reader = new StreamReader(response.GetResponseStream()))
                {
                    return reader.ReadToEnd();
                }
            }
        }
    }
}