Poshex: Plain Old Semantic HTML Extension
=========================================

This was my project for the [Web Technologies][1] course.

Poshex is an extension for Google Chrome which scans visited pages for semantic
markup formats (Microdata, RDFa and microformats) and signals the presence by
showing an icon in the address bar.

![Screen shot](/paper/source-view.png)

Like modern extensions, it is intended to be unobtrusive and lightweight. It
only scans the page to detect the presence of each format and it only parses and
converts the data when selected.

When selected it opens a new tab which shows:

* the autoformatted page source code with attributes specific to
    Microdata and RDFa being  highlighted;
* for each of the detected formats, the scanner specific data format;
* RDF/XML conversion (for all);
* Turtle conversion (for Microdata and RDFa);
* CSV conversion for Microdata;
* a graph for microformats;
* a table view for Microdata.

All the text formats shown are syntax highlighted and can be saved locally.

The purpose of this extension is to give developers the posibility to visualize
and inspect web pages with structured data.

You can [read the full description][2] in the associated paper.

[1]: http://profs.info.uaic.ro/~busaco/teach/courses/web/index.html
[2]: https://github.com/paul-nechifor/poshex/raw/master/paper/paper.pdf
