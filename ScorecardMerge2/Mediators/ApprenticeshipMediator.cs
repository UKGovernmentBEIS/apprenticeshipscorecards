using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System;
using System.Net.Http;
using System.Threading.Tasks;
using System.Text.RegularExpressions;
using System.Net;
using System.IO;

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
        
        public async Task<object> RetrieveProvidersJson(int page, string search, string postcode, int? distance)
        {
            using (var httpClient = new HttpClient { BaseAddress = _apiUrl })
            {
                var enpoint = String.IsNullOrEmpty(search)
                    ? string.Format("providers?page_size=20&page_number={0}", page)
                    : string.Format("providers/search?page_size=20&phrase={0}&page_number={1}", search, page);

                if (!String.IsNullOrEmpty(postcode) && distance.HasValue)
                {
                    const double radiusOfEarthInMiles = 3959.0; //ummm... todo?
                    double latitude, longitude;
                    ResolveAddress(postcode, out latitude, out longitude);
                    if (!double.IsNaN(latitude) && !double.IsNaN(longitude))
                    {
                        double delta_lat = 360.0 * distance.Value / (2.0 * Math.PI * radiusOfEarthInMiles);
                        double delta_long = delta_lat / Math.Cos(Math.Abs(latitude) * Math.PI / 180.0);

                        enpoint = String.Format("{0}&query=address.longitude>{1} and address.longitude<{2} and address.latitude>{3} and address.latitude<{4}",
                            enpoint,
                            longitude - delta_long,
                            longitude + delta_long,
                            latitude - delta_lat,
                            latitude + delta_lat);
                    }
                }
                
                using (var response = await httpClient.GetAsync(enpoint)) 
                {
                    var jsonString = await response.Content.ReadAsStringAsync();
                    var numberList = new List<int>(64);
                    // some genuinely horrid json parsing here...
                    foreach (Match item in Regex.Matches(jsonString, "\"ukprn\":([0-9]*)"))
                    {
                        numberList.Add(int.Parse(item.Groups[1].Value));
                    }
                    return new { providers = jsonString, apprenticeships = await RetrieveApprenticeships(numberList.ToArray()) };
                }
            }
        }

        private void ResolveAddress(string postcode, out double latitude, out double longitude)
        {

            HttpWebRequest request = (HttpWebRequest)WebRequest.Create(string.Format("{0}postcodes?query={1}", _postCodesApiUrl, postcode))   ;
            request.Method = "GET";
            request.Accept = "text/json";
            //request.KeepAlive = false;
            //request.ProtocolVersion = HttpVersion.Version10;
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

        internal async Task<object> RetrieveProviderDetail(int ukprn)
        {
            return new
            {
                providers = await RetrieveProvidersDetails(new int[] { ukprn }),
                apprenticeships = await RetrieveApprenticeships(new int[] {ukprn})
            };
        }

        private async Task<string> RetrieveApprenticeships(int[] ukprn) {
            if (!ukprn.Any())
            {
                return RequestJson("apprenticeships?query=provider_id=0");
            }
            var queryStringForApprenticeships = string.Join(" or ", ukprn.Select(x => string.Format("provider_id={0}", x)));
            var apprenticeshipEnpoint = string.Format("apprenticeships?page_size=250&query={0}", queryStringForApprenticeships);
            return RequestJson(apprenticeshipEnpoint);
        }
        private async Task<string> RetrieveProvidersDetails(int[] ukprn) {
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