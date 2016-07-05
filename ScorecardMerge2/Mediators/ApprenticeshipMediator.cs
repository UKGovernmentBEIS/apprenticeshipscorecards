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

        public ApprenticeshipMediator(string apiURL)
        {
            _apiUrl = new Uri(apiURL);
        }

        //dev only constructor override
        [Obsolete]
        public ApprenticeshipMediator() : this("https://apprenticeship-scorecard-api.herokuapp.com/") { }
        
        public async Task<object> RetrieveProvidersJson(int page, string search)
        {
            using (var httpClient = new HttpClient { BaseAddress = _apiUrl })
            {
                var enpoint = String.IsNullOrEmpty(search)
                    ? string.Format("providers?page_size=20&page_number={0}", page)
                    : string.Format("providers/search?page_size=20&phrase={0}&page_number={1}", search, page);

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

        internal async Task<object> RetrieveProviderDetail(int ukprn)
        {
            return new
            {
                providers = await RetrieveProvidersDetails(new int[] { ukprn }),
                apprenticeships = await RetrieveApprenticeships(new int[] {ukprn})
            };
        }

        private async Task<string> RetrieveApprenticeships(int[] ukprn) {
            var queryStringForApprenticeships = string.Join(" or ", ukprn.Select(x => string.Format("provider_id={0}", x)));
            var apprenticeshipEnpoint = string.Format("apprenticeships?page_size=250&query={0}", queryStringForApprenticeships);
            return RequestJson(apprenticeshipEnpoint);
        }
        private async Task<string> RetrieveProvidersDetails(int[] ukprn) {
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