/// <autosync enabled="true" />
/// <reference path="modernizr-2.6.2.js" />
/// <reference path="jquery-1.10.2.js" />
/// <reference path="jquery.validate.js" />
/// <reference path="jquery.validate.unobtrusive.js" />
/// <reference path="bootstrap.js" />
/// <reference path="respond.js" />
/// <reference path="d3.js" />

var state;

(function initialisePage() {
    state = {
        providerpage: 0,
        providerXhr: null,
        lastprn: null
    };

    var requestedPrn = parseInt(window.location.hash.slice(1));
    if (!!requestedPrn) {
        setMode("view-details");
        getProviderDetails(requestedPrn);
        getNextPageOfProviders(function (result) {
            return !result.find(function (i) { return i.ukprn === requestedPrn })
        })    
    } else {
        setMode("main");
        getNextPageOfProviders()
    };
})();

window.onhashchange = function () {
    var requestedPrn = parseInt(window.location.hash.slice(1));
    if (!!requestedPrn) {
        getProviderDetails(requestedPrn);
    } else {
        setMode("main");
        //window.location.hash = "#";
        var $providerbox = $("div[data-ukprn='" + state.lastprn + "']");
        if ($providerbox.length) {
            $(window).scrollTop($providerbox.offset().top - 150);
            $providerbox.addClass("bump");
            setTimeout(function () { $providerbox.removeClass("bump") }, 3000);
        }
        if (!!e && e.preventDefault) {
            e.preventDefault();
        }
    }
};

function getNextPageOfProviders(fetchmore, reset) {
    if (!!state.providerXhr) {
        return;
    }
    if (reset) {
        state.providerpage = 0;
        $("#scroll-to").show();
    }
    var searchString = $("#find-provider-provider").val();

    state.providerXhr = $.ajax({
        url: "/Apprenticeship/ListData",
        dataType: "json",
        method: "POST",
        data: {
            page: state.providerpage + 1,
            search: searchString
        },
        success: function (data) {
            var providers = JSON.parse(data.providers);
            var apprenticeships = JSON.parse(data.apprenticeships);
            if (reset) {
                $("#providers-all").html("");
            }
            if (state.providerpage === providers.page_number) {
                // we reached the end of the data set - don't append duplicates.
                $("#scroll-to").hide();
                return;
            }
            if (providers.items_per_page > providers.results.length) {
                // reached the end of the data set - don't show loading indicator anymore
                $("#scroll-to").hide();
            }
            var result = matchProvidersWithApprenticeships(providers.results, apprenticeships.results);

            state.providerpage = providers.page_number;
            var rendered = Mustache.render($('#bunchOfProviders-template').html(), result);
            $('#providers-all').append(rendered);
            if (scrollToInView() || !!fetchmore && fetchmore(result)) {
                setTimeout(function () { getNextPageOfProviders(fetchmore) });
            }
            injectDataIntoNewGraphContainers(result);
            renderNewGraphs();
        },
        complete: function() {
            state.providerXhr = null;
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
        providers[i].apprenticeships = [];
        while (apprenticeships.length > j && apprenticeships[j].provider_id === providers[i].ukprn) {
            providers[i].apprenticeships.push(apprenticeships[j++]);
        }
        providers[i].number_apprenticeships = providers[i].apprenticeships.length - 1;
    }
    return providers;
}

function injectDataIntoNewGraphContainers(results, primarysubject) {
    var lot = $(".graph-container.empty")
    lot.each(function (i, elem) {
        $(elem).data("ukprn");
        var prov = results.find(function (x) { return x.ukprn === $(elem).data("ukprn") });
        if (!prov) { return; }
        $(elem).data("subjectcode");
        var subject = $(elem).data("subjectcode") || primarysubject || 0;
        var data = prov.apprenticeships.find(function (x) { return x.subject_tier_2_code === subject });
        var dataFormatted = []
        dataFormatted.push({
            type: "earnings",
            value: data && data.earnings && data.earnings.median,
            baseline: data && data.national_earnings && data.national_earnings.median
        });
        dataFormatted.push({
            type: "satisfaction",
            value: data && data.learner_stats && data.learner_stats.satisfaction,
            baseline: data && data.learner_stats && data.learner_stats.national_satisfaction
        });
        dataFormatted.push({
            type: "passrate",
            value: data && data.stats && data.stats && data.stats.success_rate,
            baseline: data && data.national_stats && data.national_stats.success_rate
        });
        $(elem).prop("__data__", dataFormatted);
    });
}

function renderNewGraphs() {
    var lot = $(".graph-container.empty:visible");
    var coords = lot.map(function (x) {
        return $(lot[x]).offset()
    });
    var range = {
        x_min: Math.min.apply(null, coords.map(function (x) { return coords[x].left })),
        y_min: Math.min.apply(null, coords.map(function (x) { return coords[x].top })),
        x_max: Math.max.apply(null, coords.map(function (x) { return coords[x].left })),
        y_max: Math.max.apply(null, coords.map(function (x) { return coords[x].top })),
    }
    maxDistance = Math.sqrt(Math.pow(range.x_max - range.x_min, 2) + Math.pow(range.y_max - range.y_min, 2));

    lot.each(function (i, elem) {
        var dataFormatted = $(elem).prop("__data__");
        var distanceFraction = Math.sqrt(Math.pow($(elem).offset().top - range.y_min, 2) + Math.pow($(elem).offset().left - range.x_min, 2)) / maxDistance;
        renderProviderGraph($(elem), dataFormatted, distanceFraction);
        $(elem).removeClass("empty");
    });
}

$(document).on("click", ".get-providerdetails", function(e) {
    //getProviderDetails($(this).data("ukprn"));
    window.location.hash = "#" + $(this).data("ukprn");
});

function getProviderDetails(ukprn) {
    var handle = setTimeout(function () {
        setMode("view-details");
        $("#details-container").html(Mustache.render($("#loading-template").html(), { message: "Loading, please wait&hellip;" }));
    }, 300  );

    state.lastprn = ukprn;
    $.ajax({
        url: "/Apprenticeship/ProviderData",
        data: { ukprn: ukprn },
        method: "POST",
        success: function (data) {
            if (handle) {
                window.clearTimeout(handle);
                setMode("view-details");
            }
            $(window).scrollTop(0);
            data = { provider: JSON.parse(data.providers).results[0], apprenticeships: JSON.parse(data.apprenticeships) };
            var viewModel = generateProviderViewModel(data);
            var rendered = Mustache.render($('#providerDetails-template').html(), viewModel);
            $('#details-container').html(rendered);
            injectDataIntoNewGraphContainers([viewModel])
            renderNewGraphs();
        }
    })
}

function generateProviderViewModel(raw) {
    raw.provider.apprenticeships = raw.apprenticeships.results;
    return raw.provider;
}

$(document).on("click", ".prevent-propagation", function (event) {
    event.stopPropagation();
    return true;
});

function setMode(mode) {
    $('#main-container').attr("mode", mode);
    setTimeout(renderNewGraphs);
}

//when scrolling to the bottom of the list, load more Providers
$(window).scroll(function () {
    if (scrollToInView()) {
        getNextPageOfProviders();
    }
});

function scrollToInView() {
    if (!$("#scroll-to").is(":visible")) {
        return false;
    }
    var hT = $('#scroll-to').offset().top,
       hH = $('#scroll-to').outerHeight(),
       wH = $(window).height(),
       wS = $(this).scrollTop();
    if (wS > (hT + hH - wH)) {
        return true;
    }
    return false;
}

$('#find-provider-provider').keypress(debounce(findProvider, 500))

function debounce(evtHandler, interval) {
    var handle = null;

    return function (e) {
        if (e.keyCode === 13) {
            e.preventDefault();
        }
        if (!!handle) {
            window.clearTimeout(handle);    
        }
        handle = setTimeout(function () { evtHandler(e); }, interval || 500);
    }
}

function findProvider(e) {
    
    getNextPageOfProviders(null, true);
}

$("#clear-search").click(function (e) {
    $("#find-provider-provider").val("");
    findProvider();
})

function renderProviderGraph($elem, data, delay) {
    var earningsRange = [10000, 50000] //todo:check
    var maxPass = 100;
    var maxSatisfaction = 10;

    var height = $elem.height();
    var width = $elem.width();

    var x = d3.scaleBand()
        .domain(d3.range(data.length))
        .range([0, width])
        .padding(0.3);
    
    var ys = data.map(function (x) {
        switch (x.type) {
            case "earnings":
                return d3.scaleLog()
                    .base(2)
                    .domain(earningsRange)
                    .range([0, height]);
            case "satisfaction":
                return d3.scaleLinear()
                    .domain([0, maxSatisfaction])
                    .range([0, height]);
            case "passrate":
                return d3.scaleLinear()
                    .domain([0, maxPass])
                    .range([0, height]);
            default:
                throw new "unknown data type: " + x.type
        }
    });

    var color = d3.scaleColor

    //var xAxis = d3.svg.axis()
    //    .scale(x)
    //    .tickSize(0)
    //    .tickPadding(6)
    //    .orient("bottom");

    var svg = d3.select($elem[0]).append("svg")
        .attr("width", width)
        .attr("height", height);

    var bar = svg.selectAll(".bar")
        .data(data)
        .enter().append("g")
            .attr("class", "bar")
            .datum(function (d) { return d; });

    var backgroundRect = bar.append("rect")
                    .attr("x", function (d, i) { return x(i); })
                    .attr("y", function (d, i) { return 0 })
                    .attr("width", function (d) { return x.bandwidth() })
                    .attr("height", function (d, i) { return height })
                    .attr("class", "databar")
                    .style("fill", function (d, i) { if (!d.value) return "#ccc"; var c = d3.hsl(d3.interpolateCool(i / data.length)).brighter(); c.s -= 0.2; c.l += 0.1; return c.toString(); });                    ;
    
    var rect = bar.append("rect")
                    .attr("x", function (d, i) {return x(i);})
                    .attr("y", height)
                    .attr("width", function (d) { return x.bandwidth() })
                    .attr("height", 0)
                    .style("fill", function (d, i) { var c = d3.hsl(d3.interpolateCool(i / data.length)); c.l += 0.1; c.s += 0.1; return c.toString() })//"#1A76FF")
                    .style("display", function(d) {return d.value ? "inherit" : "none"});
                    

    var baseline = bar.append("line")
        .attr("x1", function(d,i) {return x(i) + 0.2*(x.step() - x.bandwidth());})
        .attr("x2", function (d, i) { return x(i) + x.bandwidth() - 0.2 * (x.step() - x.bandwidth()) })
        .attr("y1", 0)
        .attr("y2", 0)
        .attr("stroke", "#333")
        .attr("stroke-width", 3)
        .style("display", function(d) {return d.baseline ? "inherit" : "none";});

    baseline.transition()
        .delay(function (d, i) { return 100 + 10 * i + 400 * delay; })
        .duration(450)
        .ease(d3.easeQuadOut)
        .attr("y1", function (d, i) { return !!d.baseline ? height - ys[i](d.baseline) : 0 })
        .attr("y2", function (d, i) { return !!d.baseline ? height - ys[i](d.baseline) : 0 })

    rect.transition()
        .delay(function (d, i) { return 10 * i + 400* delay; })
        .duration(450)
        .ease(d3.easeQuadOut)
        .attr("y", function (d, i) { return !!d.value ? height - ys[i](d.value) : height })
        .attr("height", function (d, i) { return !!d.value ? ys[i](d.value) : 0 })

           
}

$(document).on("mouseover", ".bar", function (e) {
    $(".datatooltip").remove();
    var $bar = $(this);
    var isSubject = !!$bar.closest(".singleSubject").length;
    var data = $bar.prop("__data__");
    var div = $("<div class='datatooltip'></div>").appendTo("body")
        .css("top", $bar.offset().top + $bar[0].getBBox().height + 10)
        .css("left", $bar.offset().left + $bar[0].getBBox().width / 2 - 125);

    var elementDescriptor = isSubject
        ? "subject"
        : "training provider";
    var inorwith = isSubject
        ? "in" : "with";

    if (!data || !data.value) {
        div.html(Mustache.render($("#nodataTooltip-template").html(), {
            descriptor:
                !data.type ? "No data available"
                : data.type === "earnings" ? "Earnings data of previous learners is unavailable for this "+elementDescriptor+"."
                : data.type === "satisfaction" ? "Ratings of this " + elementDescriptor + " by previous learners are unavailable ."
                : data.type === "passrate" ? "Qualification rate of previous learners is unavalable for this " + elementDescriptor + "."
                : "No data available"
        }));
        return;
    }


    switch (data.type) {
        case "earnings": div.html(Mustache.render($("#earningsTooltip-template").html(), {
            value: toMoneyString(data.value),
            difference: toMoneyString(Math.abs(data.value - data.baseline)),
            moreorless: data.value < data.baseline ? "less" : "more",
            betterorworse: data.value < data.baseline ? "worse" : "better",
            elementdescriptor: elementDescriptor,
            inorwith: inorwith

        })); break;
        case "passrate": div.html(Mustache.render($("#passrateTooltip-template").html(), {
            value: data.value.toFixed(0),
            difference: Math.abs(data.value - data.baseline).toFixed(0),
            moreorless: data.value < data.baseline ? "less" : "more",
            betterorworse: data.value < data.baseline ? "worse" : "better",
            elementdescriptor: elementDescriptor,
            inorwith: inorwith
        })); break;
        case "satisfaction": div.html(Mustache.render($("#satisfactionTooltip-template").html(), {
            value: data.value.toFixed(1),
            difference: Math.abs(data.value - data.baseline).toFixed(1),
            moreorless: data.value < data.baseline ? "less" : "more",
            betterorworse: data.value < data.baseline ? "worse" : "better",
            elementdescriptor: elementDescriptor,
            inorwith: inorwith
        })); break;
        default: throw new "unknown data type: " + data.type;
    }
}).on("mouseout", ".bar", function (e) {
    $(".datatooltip").remove();
});

function toMoneyString(number) {
    if (number < 10000) { return number.toFixed(0); }
    var intermediate = number;
    var string = (intermediate % 1000).toFixed(0);
    
    while (intermediate / 1000 >= 1) {
        while ((string.length+1) % 4 !== 0) string = "0" + string; //eww

        intermediate = Math.floor(intermediate / 1000);
        string = Math.floor(intermediate % 1000) + "," + string;
        
    }
    return string;
}

//renderProviderGraph($('#testGraph'),
//    [
//        { type: "earnings", value: 20000, baseline:18300 },
//        { type: "satisfaction", value: 2.1, baseline:8.3 },
//        { type: "passrate", value: 91, baseline: 68 }
//    ], 0);
