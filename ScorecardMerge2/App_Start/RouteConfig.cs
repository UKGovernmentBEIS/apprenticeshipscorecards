using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using System.Web.Routing;

namespace ScorecardMerge2
{
    public class RouteConfig
    {
        public static void RegisterRoutes(RouteCollection routes)
        {
            routes.IgnoreRoute("{resource}.axd/{*pathInfo}");

            routes.MapRoute("ApprenticeshipDetails",
                "Apprenticeship/Details/{ukprn}",
                new { controller = "Apprenticeship", action = "Details" });

            routes.MapRoute(
                name: "Default",
                url: "{controller}/{action}",
                defaults: new { controller = "Apprenticeship", action = "List" }
            );
        }
    }
}
