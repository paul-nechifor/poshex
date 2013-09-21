// Own extensions for jQuery.
$.fn.extend({
    appendTextNode: function (text) {
        this[0].appendChild(document.createTextNode(text));
        return this;
    },
    fixToCurrentPosition: function (fixWidth) {
        var jWindow = $(window);
        var original = this.offset();
        var originalWidth = jWindow.width();
        var elem = this;
        if (fixWidth) {
            elem.css("width", elem.width());
        }
        elem.css({
            position: "fixed",
            left: original.left,
            top: original.top - 40
        });
        jWindow.resize(function() {
            elem.css("left", original.left + (jWindow.width() - originalWidth));
        });
    }
});

chrome.extension.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.method === "dataFound") {
        dataFound(request.tabInfo);
    }
});

function dataFound(tabInfo) {
    var tabId = tabInfo.tabId;
    var parent = $("#mainContent");
    var menu = $("#mainNav ul");
    menu.fixToCurrentPosition(true);
    
    var menuPositions;
    
    var updateMenuPositions = function () {
        menuPositions = {};
        var total = $(document).height(), elem, id;
        menu.children().each(function () {
            elem = $(this);
            id = elem.find("a").attr("href");
            menuPositions[id] = [$(id).offset().top / total, elem];
        });
    }
    
    var onPagePosition = function (pos) {
        var minDist = 999999, minElem, dist, elem;
        for (var id in menuPositions) {
            elem = menuPositions[id];
            dist = Math.abs(elem[0] - pos);
            if (dist < minDist) {
                minDist = dist;
                minElem = elem[1];
            }
        }
        if (!minElem.hasClass("active")) {
            menu.find(".active").removeClass("active");
            minElem.addClass("active");
        }
    }

    var source, data;

    chainCallbacks(
        function (next) {
            extractSource(tabId, function (result) {
                source = result;
                next();
            });
        },
        function (next) {
            sourceAdd(source, tabInfo.title, tabInfo.url, updateMenuPositions);
            next();
        },
        function (next) {
            extractData(tabId, tabInfo.found, function (result) {
                data = result;
                next();
            });
        },
        function (next) {
            if (data["RDFa"] !== undefined) {
                rdfaAdd(data["RDFa"], parent, menu);
            }
            next();
        },
        function (next) {
            if (data["Microdata"]) {
                loadSchemaDotOrg(function (schema) {
                    window.schema = schema;
                    next();
                });
            } else {
                next();
            }
        },
        function (next) {
            if (data["Microdata"] !== undefined) {
                mdAdd(data["Microdata"], parent, menu);
            }
            next();
        },
        function (next) {
            if (data["Microformats"] != undefined) {
                ufAdd(data["Microformats"], parent, menu);
            }
            next();
        },
        function (next) {
            prettyPrint();
            highlightAttributes($("pre#sourceCode").get(0));
            next();
        },
        function (next) {
            updateMenuPositions();
            registerPagePosition(onPagePosition);
            next();
        }
    );
}

function chainCallbacks() {
    var i = 0, args = arguments, lenM1 = args.length - 1;
    
    var func = function () {
        if (i < lenM1) {
            i++;
            setTimeout(args[i], 1, func);
        }
    };
    
    setTimeout(args[i], 1, func);
}

function extractSource(tabId, callback) {
    var code = {code: "document.documentElement.outerHTML;"};
    chrome.tabs.executeScript(tabId, code, function(html) {
        callback(html[0]);
    });
}

function extractData(tabId, types, callback) {
    var injections = {};
    
    injections["RDFa"] = [
        {file: "lib/jquery-1.8.3.min.js"},
        {file: "lib/rdfQuery/jquery.uri.js"},
        {file: "lib/rdfQuery/jquery.xmlns.js"},
        {file: "lib/rdfQuery/jquery.datatype.js"},
        {file: "lib/rdfQuery/jquery.curie.js"},
        {file: "lib/rdfQuery/jquery.json-1.3.min.js"},
        {file: "lib/rdfQuery/jquery.rdfquery.core.min-1.0.js"},
        {file: "lib/rdfQuery/jquery.rdfquery.rdfa.min-1.0.js"},
        {code:
            "var db = $('html').rdf().databank;" +
            "var opt = {format: 'application/rdf+xml', serialize: true};" +
            "var ret = {json: db.dump(), xml: db.dump(opt)};" +
            "ret;"
        }
    ];
    
    injections["Microdata"] = [
        {file: "lib/jquery-1.8.3.min.js"},
        {file: "lib/microdata.js/jquery.microdata.js"},
        {file: "lib/microdata.js/jquery.microdata.json.js"},
        {code: "$.microdata.json()"}
    ];
    
    injections["Microformats"] = [
        {file: "lib/shiv/microformats-shiv.min.js"},
        {file: "lib/shiv/microformats-coredefinition.min.js"},
        {file: "getMicroformats.js"}
    ];
    
    var data = {}, i = 0, len = types.length, type;
    var func = function () {
        if (i === len) {
            callback(data);
            return;
        }
        type = types[i];
        
        injectAndGetResults(injections[type], tabId, function (results) {
            data[type] = results[0];
            i++;
            func();
        });
    };
    
    func();
}

function loadSchemaDotOrg(callback) {
    var req = new XMLHttpRequest();
    //req.open("GET", "http://schema.rdfs.org/all.json", true);
    req.open("GET", "schema.json", true);
    req.onload = function() {
        callback(JSON.parse(req.responseText));
    };
    req.send(null);
}

function injectAndGetResults(injections, tabId, callback) {
    var i = 0, len = injections.length;
    var func = function(result) {
        if (i === len) {
            callback(result);
            return;
        }
        
        chrome.tabs.executeScript(tabId, injections[i], function(r) {
            i++;
            func(r);
        });
    };
    func();
}

function sourceAdd(html, title, url, updateMenu) {
    document.title = "Poshex: " + title;
    $("h1").text(document.title);
    var beautified = style_html(html, {
      indent_size: 2,
      indent_char: " ",
      max_char: 80
    });
    
    var pre = $("pre#sourceCode");
    pre.text(beautified);
    pre.addClass("pre-scrollable");
    $("#expandSourceCode").click(function() {
        var smallSize = pre.height();
        pre.removeClass("pre-scrollable");
        var fullSize = pre.height();
        pre.css("height", smallSize);
        pre.animate({height: fullSize}, 2000, function() {
            pre.css("height", "auto");
        });
        $(this).remove();
        updateMenu();
    });
}

function rdfaAdd(rdf, parent, menu) {
    var type = addType(parent, menu, "rdfaH2", "RDFa");
    
    var fixed = rdfaFixDom($(rdf.xml)[0]);
    var xml = style_html(xmlToStr(fixed.rdf), {indent_size:2, indent_char:" "});
    var json = JSON.stringify(rdf.json, undefined, 4);
    var lines = rdfaJsonToTable(rdf.json);
    var csv = tableToCsv(lines);
    var turtle = rdfaJsonToTurtle(rdf.json, fixed.ns);
    
    addTextContent(type, menu, "rdfXml", "RDF/XML", xml, "application/rdf+xml");
    addTextContent(type, menu, "rdfJson", "JSON", json, "application/json");
    addTextContent(type, menu, "rdfCsv", "CSV triples", csv, "text/csv");
    addTextContent(type, menu, "rdfTurtle", "Turtle", turtle, "text/turtle");
}

function mdAdd(microdata, parent, menu) {
    var objectItems = JSON.parse(microdata).items;
    
    var type = addType(parent, menu, "microdataH2", "Microdata");
    
    var items = JSON.stringify(objectItems, undefined, 4);
    var r = mdJsonToRdf(objectItems);
    var bRdf = style_html(xmlToStr(r.rdf), {indent_size: 2, indent_char: " "});
    var turtle = mdJsonToTurtle(objectItems, r.ns);
    
    addTextContent(type, menu, "mdJson", "JSON", items, "application/json");
    addItemsContent(type, menu, "mdItems", "Items", objectItems);
    addTextContent(type, menu, "mdRdf", "RDF/XML", bRdf, "application/rdf+xml");
    addTextContent(type, menu, "mdTurtle", "Turtle", turtle, "text/turtle");
}

function ufAdd(uf, parent, menu) {
    var type = addType(parent, menu, "ufH2", "Microformats");
    
    var json = JSON.stringify(uf, undefined, 4);
    var rdf = ufToRdf(uf);
    var bRdf = style_html(xmlToStr(rdf), {indent_size: 2, indent_char: " "});
    var graph = ufJsonToGraph(uf);
    
    addTextContent(type, menu, "ufJson", "JSON", json, "application/json");
    addTextContent(type, menu, "ufRdf", "RDF/XML", bRdf, "application/rdf+xml");
    addD3GraphContent(type, menu, "ufGraph", "Graph", graph);
}

function addType(parent, menu, id, title) {
    var html = '<div><h2 id="' + id + '">' + title + '</h2></div>';
    var ret = $(html);
    ret.appendTo(parent);
    addToMenu(menu, id, title, true);
    return ret;
}

function addSubType(parent, menu, id, title, middleFunc) {
    $("<h3></h3>")
        .text(title)
        .attr("id", id)
        .appendTo(parent);
        
    middleFunc();
        
    addToMenu(menu, id, title, false);
}

function addDownload(parent, content, contentType) {
    var uriContent = "data:" + contentType + "," + encodeURIComponent(content);
    parent.appendTextNode("(");
    $("<a>Save as...</a>")
        .attr("href", uriContent)
        .appendTo(parent);
    parent.appendTextNode(")");
}

function addToMenu(menu, id, title, parent) {
    var c = " class='" + (parent ? "parent" : "child") + "'";
    var h = "<li" + c + "><a href='#" + id + "'>" + title + "</a></li>"
    $(h).appendTo(menu);
}

function addTextContent(parent, menu, id, title, content, type) {
    addSubType(parent, menu, id, title, function () {
        addDownload(parent, content, type);
        $("<pre class='prettyprint linenums'></pre>")
            .text(content)
            .appendTo(parent);
    });
}

function addItemsContent(parent, menu, id, title, items) {
    addSubType(parent, menu, id, title, function () {
        var itemsDiv = $("<div/>");
        parent.append(itemsDiv);
        
        for (var itemName in items) {
            mdAddItem(itemsDiv, items[itemName]);
        }
    });
}

function addD3GraphContent(parent, menu, id, title, graph) {
    addSubType(parent, menu, id, title, function () {
        var id = getUnusedId();
        $("<div/>").attr("id", id).attr("class", "graph").appendTo(parent);
        ufAddGraph(graph, id);
    });
}

function mdAddItem(parent, item) {
    var itemDiv = $("<div class='item'></div>");
    parent.append(itemDiv);
    
    // Adding the type or types.
    var itemTypes = $("<div class='types'></div>");
    itemDiv.append(itemTypes);
    var types = item.type;
    var len = types.length;
    mdAddItemType(itemDiv, types[0]);
    
    if (len > 1) {
        itemTypes.appendTextNode("(");
        mdAddItemType(itemDiv, types[1]);
        for (var i = 2; i < len; i++) {
            itemTypes.appendTextNode(", ");
            mdAddItemType(itemDiv, types[i]);
        }
        itemTypes.appendTextNode(")");
    }
    itemDiv.appendTextNode(":");
    
    // Adding properties.
    var itemProps = $("<table class='properties'></table>");
    itemDiv.append(itemProps);
    var props = item.properties, propLi, sp;
    for (var propName in props) {
        propLi = $("<tr/>").appendTo(itemProps);
        sp = schema.properties[propName];
        if (sp !== undefined) {
            mdAddProperty(propLi, sp.label, sp.comment_plain, props[propName]);
        } else {
            mdAddProperty(propLi, propName, undefined, props[propName]);
        }
    }
}

function mdAddItemType(parent, type) {
    var element = $("<a/>");
    var typeName = type;
    if (typeName.indexOf("http://schema.org/") === 0) {
        typeName = type.substring(18); // "http://schema.org/".length
    }
    element
        .text(typeName)
        .attr("href", type)
        //.attr("title", schema)
        .appendTo(parent);
}

function mdAddProperty(parent, label, comment, values) {
    var td = $("<td/>")
        .text(label + ":")
        .appendTo(parent);
    if (comment !== undefined) {
        td.attr("title", comment);
    }
    td = $("<td/>").appendTo(parent);
        
    var len = values.length, value;
    if (len === 1) {
        value = values[0];
        if (typeof value === "string") {
            td.text(value);
        } else {
            mdAddItem(td, value);
        }
    } else {
        var valuesUl = $("<ul/>").appendTo(td), li;
        
        for (var i = 0; i < len; i++) {
            value = values[i];
            li = $("<li/>").appendTo(valuesUl);
            if (typeof value === "string") {
                li.text(values[i]);
            } else {
                mdAddItem(li, value);
            }
        }
    }
}

function mdJsonToRdf(items) {
    var rdf = document.createElementNS("a", "rdf:RDF");
    rdf.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
    rdf.setAttribute("xmlns:rdf", "http://www.w3.org/1999/02/22-rdf-syntax-ns#");
    rdf.setAttribute("xmlns:schema", "http://schema.org/");

    var ns = {"http://schema.org/": "schema"};

    for (var itemName in items) {
        mdJsonToRdfAddItem(rdf, items[itemName], ns, rdf);
    }
    
    return {rdf: rdf, ns: ns};
}


function mdJsonToRdfAddItem(parent, item, ns, root) {
    var urlType = item.type[0];
    
    var pt = mdGetPrefixAndType(root, ns, urlType);
    var desc = document.createElementNS("a", pt.prefix + ":" + pt.type);
    parent.appendChild(desc);
    
    var props = item.properties;
    for (var propName in props) {
        mdJsonToRdfAddProperty(desc, pt.prefix, propName, props[propName], ns,
                root);
    }
}

function mdJsonToRdfAddProperty(parent, prefix, propName, values, ns, root) {
    var prop = document.createElementNS("a", prefix + ":" + propName);
    parent.appendChild(prop);
    
    var len = values.length, value;
    if (len === 1) {
        value = values[0];
        if (typeof value === "string") {
            prop.textContent = value;
        } else {
            mdJsonToRdfAddItem(prop, value, ns, root);
        }
    } else {
        var li, bag = document.createElementNS("a", "rdf:Bag");
        prop.appendChild(bag);
        for (var i = 0; i < len; i++) {
            li = document.createElementNS("a", "rdf:li");
            bag.appendChild(li);
            value = values[i];
            if (typeof value === "string") {
                prop.textContent = value;
            } else {
                mdJsonToRdfAddItem(li, value, ns, root);
            }
        }
    }
}

function mdJsonToTurtle(items, ns) {
    var lines = [];
    
    for (var url in ns) {
        lines.push("@prefix " + ns[url] + ": <" + url + "> .");
    }
    lines.push("");

    var blank = 0;
    for (var itemName in items) {
        lines.push("_:blank" + blank + " ");
        blank++;
        mdJsonToTurtleAddItem(0, lines, items[itemName], ns);
    }
    
    return lines.join("\n");
}

function mdJsonToTurtleAddItem(indents, lines, item, ns) {
    var pt = mdGetPrefixAndType(undefined, ns, item.type[0])
    lines[lines.length - 1] += "a " + pt.prefix + ":" + pt.type + " ;";
    
    var props = item.properties, values, propName;
    var propsKeys = Object.keys(props);
    for (var k = 0, len2 = propsKeys.length; k < len2; k++) {
        propName = propsKeys[k];
        values = props[propName];
        
        for (var i = 0, len = values.length; i < len; i++) {
            lines.push(getIndents(indents+1) + pt.prefix+":"+propName+" ");
            mdJsonToTurtleWrapItem(indents + 1, lines, values[i], ns,
                    k === len2-1 && i === len-1);
        }
    }
    
    if (len2 === 0) {
        lines[lines.length - 1] += " .";
    }
}

function mdJsonToTurtleWrapItem(indents, lines, item, ns, stop) {
    var endMark = stop ? " ." : " ;";
    if (typeof item === "string") {
        lines[lines.length - 1] += JSON.stringify(item) + endMark;
    } else {
        lines[lines.length - 1] += "[";
        lines.push(getIndents(indents + 1));
        mdJsonToTurtleAddItem(indents, lines, item, ns);
        lines.push(getIndents(indents) + "]" + endMark);
    }
    if (stop) {
        lines.push("");
    }
}

function mdGetPrefixAndType(root, ns, urlType) {
    var split = urlType.split("/");
    var urlPrefix = split.splice(0, split.length - 1).join("/") + "/";
    var type = split[split.length - 1];
    var prefix = null;
    
    for (var url in ns) {
        if (urlPrefix === url) {
            prefix = ns[url];
            break;
        }
    }
    
    if (prefix === null) {
        prefix = "ns" + Object.keys(ns).length;
        ns[urlPrefix] = prefix;
        root.setAttribute("xmlns:" + prefix, urlPrefix);
    }
    
    return {prefix: prefix, type: type};
}

function rdfaJsonToTable(json) {
    var properties, values, len, value;
    var lines = [];
    for (var subject in json) {
        properties = json[subject];
        for (var property in properties) {
            values = properties[property];
            len = values.length;
            for (var i = 0; i < len; i++) {
                value = values[i];
                lines.push([subject, property, value.value]);
            }
        }
    }
    return lines;
}

function rdfaJsonToTurtle(json, ns) {
    var lines = [];
    
    for (var url in ns) {
        lines.push("@prefix " + ns[url] + ": <" + url + "> .");
    }
    lines.push("");
    
    var prop, props, propsKeys;
    for (var subject in json) {
        lines.push("<" + subject + ">");
        props = json[subject];
        propsKeys = Object.keys(props);
        
        for (var i = 0, len = propsKeys.length; i < len; i++) {
            prop = propsKeys[i];
            rdfaAddProperties(prop, props[prop], ns, lines);
            if (i === len - 1) {
                lines[lines.length - 1] += " .";
            } else {
                lines[lines.length - 1] += " ;";
            }
        }
        
        lines.push("");
    }
    
    
    return lines.join("\n");
}

function rdfaAddProperties(property, values, ns, lines) {
    var line = "    " + rdfaGetProperty(property, ns);
    var len = values.length;
    
    if (len === 1) {
        lines.push(line + " " + rdfaGetValueString(values[0]));
        return;
    }
    
    lines.push(line);
    var lenM1 = len - 1;
    for (var i = 0; i < lenM1; i++) {
        lines.push("        " + rdfaGetValueString(values[i]) + " ,");
    }
    lines.push("        " + rdfaGetValueString(values[lenM1]));
}

function rdfaGetProperty(url, ns) {
    for (var urlPrefix in ns) {
        if (url.indexOf(urlPrefix) === 0) {
            return ns[urlPrefix] + ":" + url.substring(urlPrefix.length);
        }
    }
    return "<" + url + ">";
}

function rdfaGetValueString(value) {
    var type = value.type;
    var ret;
    if (type === "uri") {
        return "<" + value.value + ">";
    } else if (type === "literal") {
        ret = JSON.stringify(value.value);
        if (value.lang) {
            ret += "@" + value.lang;
        }
        return ret;
    } else {
        return JSON.stringify(value.value);
    }
}

function rdfaFixDom(rdf) {
    var ns = rdfaGetNamespaces(rdf);
    if (!rdf.hasAttribute("xmlns")) {
        rdf.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
    }
    rdfaFixDomProcessElement(rdf, ns, rdf);
    return {rdf: rdf, ns: ns};
}

function rdfaGetNamespaces(elem) {
    var ns = {};
    var attrs = elem.attributes, attr, parts;
    for (var i = 0, len = attrs.length; i < len; i++) {
        attr = attrs[i];
        parts = attr.nodeName.split(":");
        if (parts[0] === "xmlns") {
            ns[attr.nodeValue] = parts[1];
        }
    }
    return ns;
}

function rdfaFixDomProcessElement(elem, ns, root) {
    var children = elem.childNodes, child, attr, prefixUrl;
    for (var i = 0, len = children.length; i < len; i++) {
        child = children[i];
        if (child.nodeType == Node.ELEMENT_NODE) {
            if (child.hasAttribute("xmlns:xml")) {
                child.removeAttribute("xmlns:xml");
            }
            
            attr = child.getAttribute("xml:lang");
            if (attr) {
                child.removeAttribute("xml:lang");
                child.setAttribute("lang", attr);
            }
            
            prefixUrl = child.getAttribute("xmlns:undefined");
            if (prefixUrl) {
                child.removeAttribute("xmlns:undefined");
            }
            
            if (child.tagName.indexOf("UNDEFINED:") === 0) {
                child = rdfaFixDomFixElement(child, elem, root, ns, prefixUrl);
            }
            
            rdfaFixDomProcessElement(child, ns, root);
        }
    }
}

function rdfaFixDomFixElement(elem, parent, root, ns, prefixUrl) {
    var newPrefix;
    if (!prefixUrl) {
        newPrefix = parent.tagName.split(":")[0];
    } else {
        newPrefix = ns[prefixUrl];
        if (newPrefix === undefined) {
            newPrefix = "ns" + Object.keys(ns).length;
            ns[prefixUrl] = newPrefix;
            root.setAttribute("xmlns:" + newPrefix, prefixUrl);
        }
    }
    
    var nameParts = elem.tagName.split(":");
    var newName = newPrefix + ":" + nameParts[1];
    var newElem = document.createElement(newName);
    parent.insertBefore(newElem, elem);
    
    var i;
    var attrs = elem.attributes, attr;
    for (i = 0, len = attrs.length; i < len; i++) {
        attr = attrs[i];
        newElem.setAttribute(attr.nodeName, attr.nodeValue);
    }
    
    // TODO: May need to change this. The order may be important.
    var children = elem.childNodes, child;
    for (i = children.length - 1; i >= 0; i--) {
        child = children[i];
        elem.removeChild(child);
        newElem.appendChild(child);
    }
    
    parent.removeChild(elem);
    
    return newElem;
}

function tableToCsv(lines) {
    var joined = [];
    var l;
    for (var i = 0, len = lines.length; i < len; i++) {
        l = lines[i];
        joined.push("'" + l.join("','") + "'");
    }
    return joined.join("\n");
}

function ufToRdf(uf) {
    var rdf = document.createElementNS("a", "rdf:RDF");
    rdf.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
    rdf.setAttribute("xmlns:rdf", "http://www.w3.org/1999/02/22-rdf-syntax-ns#");

    var prefixes = {
        v: "http://www.w3.org/2006/vcard/ns#",
        foaf: "http://xmlns.com/foaf/0.1/",
        con: "http://www.w3.org/2000/10/swap/pim/contact",
        hcalendar: "http://www.w3.org/2002/12/cal/icaltzd"
    };
    
    for (var prefix in prefixes) {
        rdf.setAttribute("xmlns:" + prefix, prefixes[prefix]);
    }
    
    var items;
    for (var format in uf) {
        items = uf[format];
        for (var i = 0, len = items.length; i < len; i++) {
            ufAddItem(format, items[i], rdf, rdf);
        }
    }
    
    return rdf;
}

var ufMappings = {
    "vcard": {
        "fn": ['v:fn', 'foaf:fullName'],
        "n": ['v:n', 'foaf:name'],
        "family-name": ['v:family-name', 'foaf:family_name', 'con:lastName'],
        "given-name": ['v:given-name', 'foaf:givenname', 'con:firstName'],
        "additional-name": ['v:additional-name', 'foaf:name', 'con:knownAs'],
        "honorific-prefix": ['v:honorific-prefix', 'foaf:title', 'con:personalTitle'],
        "honorific-suffix": ['v:honorific-suffix', 'con:personalSuffix'],
        "nickname": ['foaf:nick', 'con:knownAs'],
        "url": ['v:url', 'foaf:homePage', 'con:homepage'],
        "email": ['v:email', 'foaf:mbox', 'con:emailAddress'],
        "fax": ['v:fax', 'foaf:mbox', 'con:fax'],
        "tel": ['v:tel', 'foaf:phone', 'con:phone'],
        "adr": ['v:adr', 'con:address'],
        "post-office-box": ['v:post-office-box', 'con:_addressProperty'],
        "extended-address": ['v:extended-address', 'con:_addressProperty'],
        "locality": ['v:locality', 'con:city'],
        "region": ['v:region', 'con:_addressProperty'],
        "postal-code": ['v:postal-code', 'con:_addressProperty'],
        "country-name": ['v:country-name', 'con:country'],
        "label": ['v:label'],
        "geo": ['v:geo'],
        "latitude": ['v:latitude'],
        "longitude": ['v:longitude'],
        "tz": ['v:tz'],
        "photo": ['v:photo', 'foaf:img'],
        "logo": ['v:logo', 'foaf:logo'],
        "sound": ['v:sound'],
        "bday": ['v:bday', 'foaf:birthday', 'con:birthday'],
        "title": ['v:title', 'foaf:title', 'con:personalTitle'],
        "role": ['v:role'],
        "org": ['v:Organization', 'foaf:Organization', 'con:SocialEntity'],
        "organization-name": ['v:organization-name', 'foaf:name','con:departmentName'],
        "organization-unit": ['v:organization-unit'],
        "category": ['v:category'],
        "note": ['v:note'],
        "class": ['v:class'],
        "key": ['v:key'],
        "mailer": ['v:mailer'],
        "uid": ['v:uid'],
        "rev": ['v:rev'],
        "sort-string": ['v:sort-string']
    },
    "hcalendar": "http://www.w3.org/2002/12/cal/icaltzd"
};

function ufAddItem(format, item, parent, root) {
    if (typeof item === "string") {
        parent.appendChild(document.createTextNode(item));
        return;
    }
    
    if (item instanceof Array) {
        var li, bag = document.createElementNS("a", "rdf:Bag");
        parent.appendChild(bag);
        
        for (var i = 0, len = item.length; i < len; i++) {
            li = document.createElementNS("a", "rdf:li");
            bag.appendChild(li);
            ufAddItem(format, item[i], li, root);
        }
        return;
    }
    
    var desc = document.createElementNS("a", "rdf:Description");
    parent.appendChild(desc);
    
    var mapping, trans;
    for (var prop in item) {
        mapping = ufMappings[format];
        if (mapping !== undefined) {
            trans = mapping[prop];
            if (typeof trans === "string") {
                ufAddProperty(format, format+":"+prop, item[prop], desc, root);
            } else if (trans !== undefined) {
                for (i = 0, len = trans.length; i < len; i++) {
                    ufAddProperty(format, trans[i], item[prop], desc, root);
                }
            }
        }
    }
}

function ufAddProperty(format, propName, item, parent, root) {
    var prop = document.createElementNS("a", propName);
    parent.appendChild(prop);
    ufAddItem(format, item, prop, root);
}

function ufJsonToGraph(uf) {
    var nodes = [], links = [];
    
    for (var k in uf) {
        ufAddNode(k, uf, -1, nodes, links, k);
    }
    
    return {nodes: nodes, links: links};
}

function ufAddNode(key, parentObject, parentIndex, nodes, links, linkName) {
    var object = parentObject[key];
    var index = nodes.length, k;
    
    if (typeof object === "string") {
        nodes.push({type: "string", name: object});
    } else {
        nodes.push({type: "container", name: ""});
        if (object instanceof Array) {
            for (k in object) {
                ufAddNode(k, object, index, nodes, links, "");
            }
        } else {
            for (k in object) {
                ufAddNode(k, object, index, nodes, links, k);
            }
        }
    }
    
    if (parentIndex >= 0) {
        links.push({
            source: parentIndex,
            target: index,
            value: linkName
        });
    }
}

function ufAddGraph(graph, domId) {
    var width = 960, height = 550;

    var svg = d3.select("#" + domId).append("svg")
        .attr("width", width)
        .attr("height", height);

    var force = d3.layout.force()
        .gravity(.05)
        .distance(100)
        .charge(-100)
        .size([width, height]);

    force.nodes(graph.nodes)
        .links(graph.links)
        .start();

    var linkg = svg.selectAll(".link")
        .data(graph.links)
        .enter().append("g")
        .attr("class", "linkg");

    var link = linkg.append("line")
        .attr("class", "link");

    linkg.append("text")
        .attr("dy", "-3")
        .attr("text-anchor", "middle")
        .text(function (d) { return d.value; });

    var node = svg.selectAll(".node")
        .data(graph.nodes)
        .enter().append("g")
        .attr("class", "node")
        .call(force.drag);

    node.append("circle")
        .attr("r", 6);

    node.append("text")
        .attr("dx", 10)
        .attr("dy", ".35em")
        .text(function (d) { return d.name });

    force.on("tick", function() {
        link.attr("x1", function (d) { return d.source.x; })
            .attr("y1", function (d) { return d.source.y; })
            .attr("x2", function (d) { return d.target.x; })
            .attr("y2", function (d) { return d.target.y; });

        linkg.select("text")
            .attr("transform", function (d) {
                var x = (d.source.x + d.target.x) / 2;
                var y = (d.source.y + d.target.y) / 2;
                var r = -Math.atan2(d.source.x-d.target.x, d.source.y-d.target.y);
                return "rotate(" + (r * 57 - 90) + ", " + x + ", " + y + ")";
            })
            .attr("x", function (d) { return (d.source.x + d.target.x) / 2; })
            .attr("y", function (d) { return (d.source.y + d.target.y) / 2; });

        node.attr("transform", function(d) {
            return "translate(" + d.x + "," + d.y + ")";
        });
    });
}

var attributes = {
    // Microdata
    itemscope: true,
    itemprop: true,
    itemtype: true,
    // RDFa
    about: true,
    rel: true,
    rev: true,
    //src: true,
    //href: true,
    resource: true,
    property: true,
    content: true,
    datatype: true,
    "typeof": true
};

function highlightAttributes(elem) {
    var child, children = elem.childNodes;
    for (var i = 0, len = children.length; i < len; i++) {
        child = children[i];
        if (child.nodeType === Node.ELEMENT_NODE) {
                highlightAttributes(child);
        } else if (child.nodeType === Node.TEXT_NODE) {
            if (attributes[child.textContent]) {
                child = child.parentNode;
                child.className += " highlight";
                child = child.nextSibling;
                child.className += " highlight";
                child = child.nextSibling;
                child.className += " highlight";
            }
        }
    }
}

function registerPagePosition(registered) {
    var jWindow = $(window), jDoc = $(document);
    
    var func = function () {
        registered(jWindow.scrollTop() / (jDoc.height() - jWindow.height()));
    };
    jWindow.scroll(func);
    jWindow.resize(func);
}

function xmlToStr(xml) {
    var str = new XMLSerializer().serializeToString(xml);
    return str.replace(/&nbsp;/g, " ");
}

function getUnusedId() {
    // TODO: Verify it isn't used.
    return ("id" + Math.random()).replace(".", "");
}

function getIndents(n) {
    var ret = "";
    for (var i = 0; i < n; i++) {
        ret += "    ";
    }
    return ret;
}