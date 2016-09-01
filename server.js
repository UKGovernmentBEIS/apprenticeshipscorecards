var fs = require('fs'),
    http = require('http'),
    https = require('https'),
    url = require('url');


var server = http.createServer(handleRequest);

server.listen(process.env.PORT || 80);

var views = {
    "index": fs.readFileSync("node.html", { encoding: "utf-8" })
};

var scripts = {
    "/Scripts/jquery-1.10.2.min.js": fs.readFileSync("Scripts/jquery-1.10.2.min.js", { encoding: "utf-8" }),
    "/Scripts/bootstrap.min.js": fs.readFileSync("Scripts/bootstrap.min.js", { encoding: "utf-8" }),
    "/Scripts/underscore-min.js": fs.readFileSync("Scripts/underscore-min.js", { encoding: "utf-8" }),
    "/Scripts/mustache.js": fs.readFileSync("Scripts/mustache.js", { encoding: "utf-8" }),
    "/Scripts/d3.js": fs.readFileSync("Scripts/d3.js", { encoding: "utf-8" }),
    
    "/Scripts/ListProvidersUtil.js": fs.readFileSync("Scripts/ListProvidersUtil.js", { encoding: "UCS-2" }),
    "/Scripts/ListProvidersApi.js": fs.readFileSync("Scripts/ListProvidersApi.js", { encoding: "UCS-2" }),
    "/Scripts/ListProvidersGraphing.js": fs.readFileSync("Scripts/ListProvidersGraphing.js", { encoding: "UCS-2" }),
    "/Scripts/ListProviders.js": fs.readFileSync("Scripts/ListProviders.js", { encoding: "UCS-2" })    
}

//console.log(scripts);

var styles = {
    "/Content/bootstrap.css": fs.readFileSync("Content/bootstrap.css", { encoding: "utf-8" }),
    "/Content/Site.css": fs.readFileSync("Content/Site.css", { encoding: "utf-8" }),
    "/Content/ListProviders.css": fs.readFileSync("Content/ListProviders.css", { encoding: "utf-8" })
}
function handleRequest(req, res) {
    var body = "";
    req.on('data', function (chunk) {
        body += chunk;
    });
    req.on('end', function () {

        if (req.url.indexOf("/Content/") === 0) {
            res.writeHead(200, { 'Content-Type': 'text/css', 'Content-encoding': 'utf-8' });
            res.end(styles[req.url]);
            return;
        }
        if (req.url.indexOf("/Scripts/") === 0) {
            res.writeHead(200, { 'Content-Type': 'text/javascript', 'Content-encoding': 'utf-8' });
            res.end(scripts[req.url]);
            return;
        }
        if (req.url === "/") {
            res.writeHead(200, { 'Content-Type': 'text/html', 'Content-encoding': 'utf-8' });
            res.end(views.index);
            return;
        }
        if (req.url.indexOf("/Apprenticeship/ListData") === 0) {
            var params = getUrlParams("?" + body);
            listData(params, function (ships) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(ships));
            });
            return;
        }
        if (req.url.indexOf("/Apprenticeship/ProviderData") === 0) {
            var params = getUrlParams("?" + body);
            retrieveProviderDetail(params, function (provider) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(provider));
            })
            return;
        }

        res.writeHead(404);
        res.end();
        return;
    });
}

function getUrlParams(url) {
    var re = /(?:\?|&(?:amp;)?)([^=&#]+)(?:=?([^&#]*))/g,
        match, params = {},
        decode = function (s) { return decodeURIComponent(s.replace(/\+/g, " ")); };

    if (typeof url == "undefined") url = document.location.href;

    while (match = re.exec(url)) {
        params[decode(match[1])] = decode(match[2]);
    }
    return params;
}

var _apiHost = "https://apprenticeship-scorecard-api.herokuapp.com/";
//var _geocodeUrl = "https://maps.googleapis.com/maps/api/geocode/json?key=" + process.env.APPSCORECARD_GOOGLEAPI + "&region=GB&";
var _geocodeUrl = "https://maps.googleapis.com/maps/api/geocode/json?key=AIzaSyDtW4y_vGc2y_xfVJr0UZPa9ZMwTBzr1xE&region=GB&";

function listData(params, callback) {
    var effectiveSubjectCode = params['subject'] || "0";
    var sortby = params.sortby;
    var sortByField;
    var reverse;
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
    else if (sortby == "earnings" || !sortby)
    {
        sortByField = "earnings.median";
        reverse = true;
    }
    else if (sortby == "satisfaction")
    {
        sortByField = "learner_stats.satisfaction";
        reverse = true;
    } else if (sortby == "passrate")
    {
        sortByField = "stats.success_rate";
        reverse = true;
    }
    else
    {
        throw "not implemented";
    }
            
    var postcode = params.postcode;
    var distance = parseInt(params.distance) || null;

    GetLocationQueryAppendix(postcode, distance, function (locationInfo) {
        if (!locationInfo && sortByField === "distance")
        {
            sortByField = "earnings.median";
            reverse = true;
        }    

        var search = params.search
        var page = parseInt(params.page) || 1;
        var endpoint = !search
            ? "apprenticeships/search?page_size=20&page_number="+page+"&sort_by="+sortByField+"&reverse="+reverse+"&query=subject_tier_2_code="+ effectiveSubjectCode
            : "apprenticeships/search?page_size=20&phrase="+search+"&page_number="+page+"&sort_by="+sortByField+"&reverse="+reverse+"&query=subject_tier_2_code="+ effectiveSubjectCode;
        
        endpoint = endpoint + (locationInfo && locationInfo.locationAppendix || "");
        getJson(_apiHost + endpoint, function (ships) {
            var end = false;
            if (ships["results"].length == 0 || ships["page_number"] < page) {
                // we reached the end of the data set - don't append duplicates.
                callback({
                    apprenticeships: { results: [], totalcount: ships["total_results"] },
                    locationname: locationInfo && locationInfo.name || null,
                    end: true,
                    location: !!locationInfo
                });
                return;
            }

            if (ships["items_per_page"] > ships["results"].length) {
                // reached the end of the data set - don't show loading indicator anymore
                end = true;
            }

            var res = {};
            res["apprenticeships"] = {};
            res["apprenticeships"]["results"] = ships["results"];
            res["apprenticeships"]["totalcount"] = ships["total_results"];
            if (locationInfo && locationInfo.name) { res["apprenticeships"]["locationname"] = locationInfo.name; }
            res["end"] = end;
            res["location"] = !!locationInfo;
            callback(res);
        });
    });
}

function getJson(url, callback) {
    https.get(url, function(res){
        var body = '';

        res.on('data', function(chunk){
            body += chunk;
        });

        res.on('end', function () {
            var fullResponse = JSON.parse(body);
            callback(fullResponse);
        });
    }).on('error', function(e){
        callback({});
    });
};

function GetLocationQueryAppendix(postcode, distance, callback)
{
    if (!postcode || !distance) { callback({}); return;}
    var endpoint = _geocodeUrl + "address=" + postcode;
    getJson(endpoint, function (res) {
        if (res && res.results && res.results[0]) {
            var rtn = {
                latitude: res.results[0].geometry.location.lat,
                longitude: res.results[0].geometry.location.lng,
                name: res.results[0].formatted_address
            }
            rtn.locationAppendix = "&lon="+rtn.longitude+"&lat="+rtn.latitude+"&dist="+distance;
            console.log(rtn);
            callback(rtn);
        }
        else {
            callback({});
        }
    })
}


function retrieveProviderDetail(params, callback)
{
    var sanitisedPrimary = params.subject || "0";
    var apprenticeshipsJson = "apprenticeships?query=provider_id="+ params.ukprn;
    getJson(_apiHost + apprenticeshipsJson, function(ships) {
        if (ships["results"].length === 0) {
            callback({});
            return
        }
        var provider = ships["results"][0]["provider"];
        provider["apprenticeships"] = ships["results"];
        for (var i in ships.results) {
            ships.results[i].provider = null;
            if ("" + ships.results[i].subject_tier_2_code === sanitisedPrimary) {
                provider.primary = ships.results[i];                
            }
        }
        callback(provider);
    })
}