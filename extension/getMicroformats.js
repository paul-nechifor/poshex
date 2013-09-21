var microformatNames = {
    adr: "adr",
    geo: "geo",
    vevent: "hCalendar",
    vcard: "hCard",
    tag: "tag",
    xfn: "XFN",
    hreview: "hReview",
    hresume: "hResume",
    hentry: "hEntry",
    hfeed: "hFeed"
};

function search(elem, found) {
    var i, len;
    var name, classAttr = elem.getAttribute("class");
    if (classAttr) {
        var classes = classAttr.split(" ");
        for (i = 0, len = classes.length; i < len; i++) {
            name = microformatNames[classes[i].trim()];
            if (name !== undefined) {
                found.push([name, elem]);
                return; // Don't scan children.
            }
        }
    }
    
    var child, children = elem.childNodes;
    for (i = 0, len = children.length; i < len; i++) {
        child = children[i];
        if (child.nodeType == Node.ELEMENT_NODE) {
            search(child, found);
        }
    }
}

function parse() {
    var found = [];
    search(document.documentElement, found);

    var ret = {}, pair, parsed, retArray;
    for (var i = 0, len = found.length; i < len; i++) {
        pair = found[i];
        parsed = navigator.microformats.get(pair[0], pair[1])["microformats"];
        if (!parsed) {
            continue;
        }
        
        for (var ufClass in parsed) {
            retArray = ret[ufClass];
            if (retArray === undefined) {
                ret[ufClass] = parsed[ufClass];
            } else {
                Array.prototype.push.apply(retArray, parsed[ufClass]);
            }
        }
    }
    
    return ret;
}

parse();