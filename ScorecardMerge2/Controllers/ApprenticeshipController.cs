using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using ScorecardMerge2.Models;
using ScorecardMerge2.Mediators;
using System.Threading.Tasks;

namespace ScorecardMerge2.Controllers
{
    public class ApprenticeshipController : Controller
    {
        private readonly ApprenticeshipMediator _mediator = new ApprenticeshipMediator();

        // GET: Apprenticeship
        public ActionResult Index()
        {
            return RedirectToAction("List");
        }

        public ActionResult List()
        {
            return View("List");
        }

        // POST: ListData
        public async Task<JsonResult> ListData(int page, string search, string postcode, int? distance)
        {
            var jsonObject = await _mediator.RetrieveProvidersJson(page, search ?? "", postcode, distance);
            return Json(jsonObject);
        }

        // POST: ProviderData
        public async Task<JsonResult> ProviderData(int ukprn)
        {
            var jsonObject = await _mediator.RetrieveProviderDetail(ukprn);
            return Json(jsonObject);
        }
    }
}