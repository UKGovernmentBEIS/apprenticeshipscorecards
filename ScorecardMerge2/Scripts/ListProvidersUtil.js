/// <autosync enabled="true" />
/// <reference path="modernizr-2.6.2.js" />
/// <reference path="jquery-1.10.2.js" />
/// <reference path="jquery.validate.js" />
/// <reference path="jquery.validate.unobtrusive.js" />
/// <reference path="bootstrap.js" />
/// <reference path="respond.js" />
/// <reference path="d3.js" />

// ----------------------------------
// Utilities 
// ----------------------------------
function isInView($scrollTo, tolerance) {
    if (!$scrollTo.is(":visible")) {
        return false;
    }
    var hT = $scrollTo.offset().top,
       wH = $(window).height(),
       wS = $(window).scrollTop();
    if (wS + wH > (hT - tolerance)) {
        return true;
    }
    return false;
}

function toMoneyString(number) {
    if (number < 10000) { return number.toFixed(0); }
    var intermediate = number;
    var string = (intermediate % 1000).toFixed(0);

    while (intermediate / 1000 >= 1) {
        while ((string.length + 1) % 4 !== 0) string = "0" + string; //eww

        intermediate = Math.floor(intermediate / 1000);
        string = Math.floor(intermediate % 1000) + "," + string;

    }
    return string;
}

function currentRequestedProvider(setter) {
    var newVal = parseInt(setter);
    if (newVal) { window.location.hash = "#" + newVal; }
    return parseInt(window.location.hash.slice(1));
}

function debounce(evtHandler, interval) {
    var handle = null;

    return function (e) {
        if (e && e.keyCode === 13) {
            e.preventDefault();
        }
        if (!!handle) {
            window.clearTimeout(handle);
        }
        handle = setTimeout(function () { evtHandler(e); }, interval || 500);
    }
}