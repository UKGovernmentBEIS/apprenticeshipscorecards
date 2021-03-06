/// <autosync enabled="true" />
/// <reference path="modernizr-2.6.2.js" />
/// <reference path="jquery-1.10.2.js" />
/// <reference path="jquery.validate.js" />
/// <reference path="jquery.validate.unobtrusive.js" />
/// <reference path="bootstrap.js" />
/// <reference path="respond.js" />
/// <reference path="d3.js" />
// ---------------------------------------
// Graphing
// ---------------------------------------

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

function renderProviderGraph($elem, data, pDelay) {
    var delay = pDelay && pDelay <= 1 && pDelay >= 0 ? pDelay : 0;
    var earningsRange = [10000, 45000]
    var maxPass = 100;
    var maxSatisfaction = 100;

    var totalHeight = $elem.height();
    var labelsHeight = 40;
    var legendHeight = 35;

    var height = totalHeight - labelsHeight - legendHeight;

    var width = $elem.width();

    var x = d3.scaleBand()
        .domain(d3.range(data.length))
        .range([0, width])
        .paddingInner(0.3);

    var ys = data.map(function (x) {
        switch (x.type) {
            case "earnings":
                return d3.scaleLinear()
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


    var colors = ["hsla(332, 67%, 53%, 0.9)", "hsla(229, 68%, 55%, 0.7)", "hsla(100, 74%, 46%, 0.9)"];//["#D73782", "#3F5CDB", "#5ACD1F"];

    var backgroundColors = ["hsla(332, 67%, 53%, 0.2)", "hsla(229, 68%, 55%, 0.2)", "hsla(100, 74%, 46%, 0.2)"];//["#9f6f86", "#757ea3", "#6d8d5e"];

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
                    .style("fill", function (d, i) { return d.value ? backgroundColors[i] : "#ccc"; });//if (!d.value) return "#ccc"; var c = d3.hsl(d3.interpolateCool(i / data.length)).brighter(); c.s = 0.25; c.l += 0.1; return c.toString(); });                    ;

    var rect = bar.append("rect")
                    .attr("x", function (d, i) { return x(i); })
                    .attr("y", height)
                    .attr("width", function (d) { return x.bandwidth() })
                    .attr("height", 0)
                    .style("fill", function (d, i) { return colors[i]; })//var c = d3.hsl(d3.interpolateCool(i / data.length)); c.l += 0.1; c.s = 0.9; return c.toString() })//"#1A76FF")
                    .style("display", function (d) { return d && d.value ? "inline" : "none" });


    var baselinePad = 0.2 * (x.step() - x.bandwidth())
    baselinePad -= Math.floor((10 - ((x.bandwidth() - 2 * baselinePad - 5) % 10))) / 2; //making sure we have full dashes

    var baseline = bar.append("line")
        .attr("x1", function (d, i) { return x(i) + baselinePad; })
        .attr("x2", function (d, i) { return x(i) + x.bandwidth() - baselinePad })
        //.attr("x1", function (d, i) { return x(i); })
        //.attr("x2", function (d, i) { return x(i) + x.bandwidth() })
        .attr("y1", 0)
        .attr("y2", 0)
        .attr("stroke", "#333")
        .attr("stroke-width", 3)
        .attr("stroke-dasharray", "5,5")
        .style("display", function (d) { return d.baseline ? "inline" : "none"; });

    bar.append("text")
        .attr("class", "nodata noselect")
        .attr("x", function (d, i) { return x(i) + x.bandwidth()/2; })
        .attr("width", function (d, i) { return x.bandwidth() })
        .attr("y", function (d, i) { return height / 2 - 5; })
        .style("display", function (d) { return d.value ? "none" : "inline" })
        .text("No")

    bar.append("text")
        .attr("class", "nodata noselect")
        .attr("x", function (d, i) { return x(i) + x.bandwidth() / 2; })
        .attr("width", function (d, i) { return x.bandwidth() })
        .attr("y", function (d, i) { return height / 2 + 10; })
        .style("display", function (d) { return d.value ? "none" : "inline" })
        .text("Data")

    baseline.transition()
        .delay(function (d, i) { return 100 + 10 * i + 400 * delay; })
        .duration(450)
        .ease(d3.easeQuadOut)
        .attr("y1", function (d, i) { return !!d.baseline ? height - ys[i](d.baseline) : 0 })
        .attr("y2", function (d, i) { return !!d.baseline ? height - ys[i](d.baseline) : 0 })

    rect.transition()
        .delay(function (d, i) { return 10 * i + 400 * delay; })
        .duration(450)
        .ease(d3.easeQuadOut)
        .attr("y", function (d, i) { return !!d.value ? height - ys[i](d.value) : height })
        .attr("height", function (d, i) { return !!d.value ? ys[i](d.value) : 0 })

    // -----------------
    // labels and legend
    // -----------------

    var labelsContainer = d3.select($elem[0]).append("div")
        .attr("class", "label-div")
        .style("height", labelsHeight +"px")
        .style("width", "100%")

    var labels = labelsContainer.selectAll("span.noselect")
        .data(data)
        .enter().append("div")
            .attr("class", "noselect")
            .style("display", "inline-block")
            .style("text-align", "center")
            .append("div")
                .style("width", function (d, i) { return Math.floor(x.bandwidth()) + "px"; })
                .style("margin-left", function (d, i) { return i === 1 ? Math.floor(x.step() - x.bandwidth())+ "px" : 0+"px"})
                .style("margin-right", function (d, i) { return i === 1 ? Math.floor(x.step() - x.bandwidth())+ "px" : 0+"px"})


    labels.html(function (d) {
        var short = width < 270;
        var view =
              d.type === "earnings" ? { name: short ? "Pay" : "Future pay", value: d.valueFormatted}
            : d.type === "satisfaction" ? { name: short ? "Rating" : "Satisfaction", value: d.valueFormatted }
            : d.type === "passrate" ? { name: short ? "Passes" : "Pass rate", value: d.valueFormatted }
            : null;

        return Mustache.render($("#label-template").html(), view);
    })


    var baselineLegend = d3.select($elem[0]).append("svg")
        .attr("width", width)
        .attr("height", legendHeight)

    var baselineLineX1 = Math.ceil(width * 0.25 - 12 + (width * (1 / 3 - 0.25) - 5) % 10) //making sure we have full dashes

    baselineLegend.append("line")
        .attr("class", "baselineLegend")
        .attr("x1", baselineLineX1)
        .attr("x2", width / 3 - 2)
        .attr("y1", legendHeight - 7)
        .attr("y2", legendHeight - 7)
        .attr("stroke-width", 3)
        .attr("stroke-dasharray", "5,5")

    baselineLegend.append("text")
        .attr("class", "label-div noselect")
        .attr("y", legendHeight - 3)
        .attr("x", width / 3 + 2)
        .text("National average")

}


// -----------------------------------
// Data tooltip
// -----------------------------------

function renderTooltip($bar) {
    var isSubject = !!$bar.closest(".singleSubject").length;
    var data = $bar.prop("__data__");

    var targetTop = $bar.offset().top + $bar[0].getBBox().height + 10;
    var targetLeft = $bar.offset().left + $bar[0].getBBox().width / 2 - 150;
    targetLeft = Math.max(targetLeft, 0);
    targetLeft = Math.min(targetLeft, $(window).width() - 300);
     
    var div = $("<div class='datatooltip'></div>").appendTo("body")
        .css("top", targetTop)
        .css("left", targetLeft);
    
    var $correctTemplate =
          data.noData ? $("#nodataTooltip-template")
        : data.type === "earnings" ? $("#earningsTooltip-template")
        : data.type === "passrate" ? $("#passrateTooltip-template")
        : data.type === "satisfaction" ? $("#satisfactionTooltip-template")
        : null;

    div.html(Mustache.render($correctTemplate.html(), data));

    if (targetTop + $(div).outerHeight() > $(window).height() + $(window).scrollTop() //put tooltip on top if it's below the fold
        && $bar.offset().top - $(div).outerHeight() - 10 > $(window).scrollTop()) { //... unless that would place it too high to see
        div.css("top", $bar.offset().top - $(div).outerHeight() - 10);
    }

}

