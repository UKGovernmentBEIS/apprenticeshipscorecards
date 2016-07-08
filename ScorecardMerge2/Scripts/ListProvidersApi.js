/// <autosync enabled="true" />
/// <reference path="modernizr-2.6.2.js" />
/// <reference path="jquery-1.10.2.js" />
/// <reference path="jquery.validate.js" />
/// <reference path="jquery.validate.unobtrusive.js" />
/// <reference path="bootstrap.js" />
/// <reference path="respond.js" />
/// <reference path="d3.js" />

// -----------------------------------
// AJAX
// -----------------------------------
var providerXhr = null;
function fetchProviders(options) {
    var postdata = options.postdata,
        callback = options.callback,
        holdTheLine = options.holdTheLine;

    if (!!providerXhr) {
        return;
    }
    var holdTheLineHandle = null;
    if ($.isFunction(holdTheLine)) {
        holdTheLineHandle = setTimeout(holdTheLine, 300);
    }
    state.providerXhr = $.ajax({
        url: "/Apprenticeship/ListData",
        dataType: "json",
        method: "POST",
        data: {
            page: postdata.page,
            search: postdata.search,
            postcode: postdata.postcode,
            distance: postdata.distance
        },
        success: function (data) {
            var providers = JSON.parse(data.providers);
            var apprenticeships = JSON.parse(data.apprenticeships);
            if (holdTheLineHandle) { clearTimeout(holdTheLineHandle); }

            var end = false;
            if (postdata.page < providers.page_number) {
                // we reached the end of the data set - don't append duplicates.
                callback([], true);
                return;
            }
            if (providers.items_per_page > providers.results.length) {
                // reached the end of the data set - don't show loading indicator anymore
                end = true;
            }
            var result = matchProvidersWithApprenticeships(providers.results, apprenticeships.results);

            //filter out subjects
            var subjectcode = parseFloat(postdata.subject);
            if (subjectcode && subjectcode !== 0) {
                result = result.filter(function (x) {
                    return !!x.apprenticeships.find(function (y) { return y.subject_tier_2_code === subjectcode; });
                });
            }

            //filter out distant providers
            if (data.locationInfo) {
                var l = data.locationInfo;
                result = result.filter(function (x) {
                    return 1 >= Math.sqrt(
                        Math.pow((x.address.longitude - l.longitude) / l.delta_long, 2) +
                        Math.pow((x.address.latitude - l.latitude) / l.delta_lat, 2))
                })
            }

            callback(result, end);
        },
        complete: function () {
            providerXhr = null;
        }
    });
};

function matchProvidersWithApprenticeships(providers, apprenticeships) {
    providers.sort(function (a, b) { return a.ukprn - b.ukprn; });
    apprenticeships.sort(function (a, b) {
        return a.provider_id - b.provider_id !== 0
            ? a.provider_id - b.provider_id
            : a.subject_tier_2_code - b.subject_tier_2_code;
    });
    var j = 0;
    for (var i in providers) {
        providers[i].name = toTitleCase(providers[i].name)
        providers[i].apprenticeships = [];
        while (apprenticeships.length > j && apprenticeships[j].provider_id === providers[i].ukprn) {
            providers[i].apprenticeships.push(apprenticeships[j++]);
        }
        providers[i].number_apprenticeships = providers[i].apprenticeships.length - 1;
    }
    return providers;
}

function toTitleCase(str) {
    //http://stackoverflow.com/questions/196972/convert-string-to-title-case-with-javascript
    return str.replace(/\w\S*/g, function (txt) { return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(); });
}

var detailsXhr = null;
function fetchProviderDetails(options) {
    if (providerXhr) {
        providerXhr.abort();
    }
    if (detailsXhr) {
        return;
    }
    var holdTheLine = options.holdTheLine,
        callback = options.callback,
        ukprn = options.ukprn;

    var holdTheLineHandle = null;
    if ($.isFunction(holdTheLine)) {
        holdTheLineHandle = setTimeout(holdTheLine, 300);
    }

    $.ajax({
        url: "/Apprenticeship/ProviderData",
        data: { ukprn: ukprn },
        method: "POST",
        success: function (data) {
            detailsXhr = null;
            if (holdTheLineHandle) {
                clearTimeout(holdTheLineHandle);
            }
            var provider = JSON.parse(data.providers).results[0];
            provider.name = toTitleCase(provider.name);
            provider.apprenticeships = JSON.parse(data.apprenticeships).results;
            callback(provider);
        },
        complete: function () {
            detailsXhr = null;
        }
    });
}