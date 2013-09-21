function scanPage() {
    var found = [];
    
    if (scanForMicrodata(document.documentElement)) {
        found.push("Microdata");
    }
    if (scanForRdfa(document.documentElement)) {
        found.push("RDFa");
    }
    if (scanForMicroformats(document.documentElement)) {
        found.push("Microformats");
    }
    
    return found;
}

function scanForMicrodata(elem) {
    if (elem.hasAttribute("itemscope")) {
        return true;
    }
    
    var child, children = elem.childNodes;
    for (var i = 0, len = children.length; i < len; i++) {
        child = children[i];
        if (child.nodeType == Node.ELEMENT_NODE) {
            if (scanForMicrodata(child)) {
                return true;
            }
        }
    }
    
    return false;
}

function scanForRdfa(elem) {
    if (elem.hasAttribute("resource") || elem.hasAttribute("property")) {
        return true;
    }
    
    var child, children = elem.childNodes;
    for (var i = 0, len = children.length; i < len; i++) {
        child = children[i];
        if (child.nodeType == Node.ELEMENT_NODE) {
            if (scanForRdfa(child)) {
                return true;
            }
        }
    }
    
    return false;
}

var microformatClasses = {
    adr: true,
    geo: true,
    vevent: true,
    vcard: true,
    tag: true,
    xfn: true,
    hreview: true,
    hresume: true,
    hentry: true,
    hfeed: true
};

function scanForMicroformats(elem) {
    var i, len;
    var classAttr = elem.getAttribute("class");
    if (classAttr) {
        var classes = classAttr.split(" ");
        for (i = 0, len = classes.length; i < len; i++) {
            if (microformatClasses[classes[i].trim()]) {
                return true;
            }
        }
    }
    
    var child, children = elem.childNodes;
    for (i = 0, len = children.length; i < len; i++) {
        child = children[i];
        if (child.nodeType == Node.ELEMENT_NODE) {
            if (scanForMicroformats(child)) {
                return true;
            }
        }
    }
    
    return false;
}

scanPage();
