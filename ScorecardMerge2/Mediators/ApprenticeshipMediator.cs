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
        public ApprenticeshipMediator(string apiURL, string postCodesApiUrl)
        {
            _apiUrl = new Uri(apiURL);
            _postCodesApiUrl = new Uri(postCodesApiUrl);
        }

        //dev only constructor override
        [Obsolete]
        public ApprenticeshipMediator() : this("https://apprenticeship-scorecard-api.herokuapp.com/", "https://api.postcodes.io") { }

        public object RetrieveProvidersJson(int page, string sortby, string subjectcode, string search, string postcode, int? distance)
        {
            string effectiveSubjectCode = String.IsNullOrEmpty(subjectcode) ? "0" : subjectcode;
            string sortByField;
            bool reverse;
            if (sortby == "name" || string.IsNullOrEmpty(sortby))
            {
                sortByField = "name";
                reverse = false;
            }
            else if (sortby == "distance")
            {
                sortByField = "distance";
                reverse = false;
            }
            else
            {
                // TODO: implement other sort orders
                throw new NotImplementedException();
            }

            
            var locationFound = false;
            string locationAppendix = "";
            if (!String.IsNullOrEmpty(postcode) && distance.HasValue)
            {
                locationAppendix = GetLocationQueryAppendix(postcode, distance.Value);
                if (!string.IsNullOrEmpty(locationAppendix))
                {
                    locationFound = true;
                } else if (sortByField == "distance")
                {
                    sortByField = "name";
                }
            }

            var endpoint = String.IsNullOrEmpty(search)
                ? string.Format("providers/search?page_size=20&page_number={0}&sort_by={1}&reverse={2}&query=apprenticeships.subject_tier_2_code={3}", page, sortByField, reverse, effectiveSubjectCode)
                : string.Format("providers/search?page_size=20&phrase={0}&page_number={1}&sort_by={2}&reverse={3}&query=apprenticeships.subject_tier_2_code={4}", search, page, sortByField, reverse, effectiveSubjectCode);

            endpoint = endpoint + locationAppendix;

            var jsonString = RequestJson(endpoint);

            var providers = JObject.Parse(jsonString);
            var end = false;
            if (providers["results"].Count() == 0 || (int)providers["page_number"] < page)
            {
                // we reached the end of the data set - don't append duplicates.
                return new { providers = new object[0], end = true, location = locationFound };
            }

            if ((int)providers["items_per_page"] > providers["results"].Count())
            {
                // reached the end of the data set - don't show loading indicator anymore
                end = true;
            }

            foreach (var x in providers["results"])
            {
                x["number_apprenticeships"] = x["apprenticeships"].Count();
                x["apprenticeships"] = JToken.FromObject(x["apprenticeships"].Where(y => (string)y["subject_tier_2_code"] == effectiveSubjectCode));
            }

            var res = new JObject();
            res["providers"] = providers["results"]; 
            res["end"] = end;
            res["location"] = locationFound;
            
            return new JavaScriptSerializer().DeserializeObject(res.ToString());
        }

        private string GetLocationQueryAppendix(string postcode, int distance)
        {
            double latitude, longitude;
            ResolveAddress(postcode, out latitude, out longitude);
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

        private void ResolveAddress(string postcode, out double latitude, out double longitude)
        {
            HttpWebRequest request = (HttpWebRequest)WebRequest.Create(string.Format("{0}postcodes?query={1}", _postCodesApiUrl, postcode))   ;
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

        public object RetrieveProviderDetail(int ukprn)
        {
            return new JavaScriptSerializer().DeserializeObject(RetrieveProvidersDetails(new int[] { ukprn }));
        }

        private string RetrieveApprenticeships(int[] ukprn)
        {
            if (!ukprn.Any())
            {
                return RequestJson("apprenticeships?query=provider_id=0");
            }
            var queryStringForApprenticeships = string.Join(" or ", ukprn.Select(x => string.Format("provider_id={0}", x)));
            var apprenticeshipEnpoint = string.Format("apprenticeships?page_size=250&query={0}", queryStringForApprenticeships);
            return RequestJson(apprenticeshipEnpoint);
        }
        private string RetrieveProvidersDetails(int[] ukprn)
        {
            if (!ukprn.Any())
            {
                return RequestJson("providers?query=ukprn=0");
            }
            var queryStringForProviders = string.Join(" or ", ukprn.Select(x => string.Format("ukprn={0}", x)));
            var providerEndpoint = string.Format("providers?query={0}", queryStringForProviders);
            return RequestJson(providerEndpoint);
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