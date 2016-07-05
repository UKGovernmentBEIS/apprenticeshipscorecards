using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace ScorecardMerge2.Models
{
    public class ApprenticeshipDetailsModel
    {
        public readonly string ProviderName;

        public ApprenticeshipDetailsModel(string providerName)
        {
            ProviderName = providerName;
        }
    }    
}