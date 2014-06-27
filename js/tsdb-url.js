 function OpenTSDBURL(urlstring) {
 	var url = new URL(encodeURI(urlstring));
 	// grab all the non query URL items
 	this.host = url.host;
 	this.hostname  = url.hostname;
 	this.origin = url.origin;
 	this.pathname = url.pathname;
 	this.port = url.port;
 	this.protocol = url.protocol;
 	// extract the full query path and decode
 	this.query = decodeQuery(url);
 	console.info("Query: [  " + this.query + "  ]");

 	// Performs a manual decode of the query path
 	// (that is, everything after the '?')
 	// since decodeURI seems to not decode many of the symbols
 	// used by OpenTSDB URLs
 	OpenTSDBURL.prototype.decodeQuery = function(url) {
 		if(url.search=="" || url.search=="?") return "";
 		return url
 			.replace(/%20/g, " ")
 			.replace(/%7B/g, "{")
 			.replace(/%7D/g, "}")
            .replace(/%5B/g, "[")
            .replace(/%5D/g, "]") 			
			.replace(/%2520/g, " ")
 			.replace(/%257B/g, "{")
 			.replace(/%257D/g, "}")
            .replace(/%255B/g, "[")
            .replace(/%255D/g, "]"); 			
 	}
}

 /*
	tsdb-url.js
	A JS class to parse an OpenTSDB metric/UI URL into a strucured JavaScript Object
	Whitehead, 2014
 */



/*
URL {hash: "", search: "?start=5m-ago&ignore=275&m=avg:sys.cpu%257Bcpu=*,t…ange=%255B0:%255D&wxh=900x300&smooth=csplines&png", pathname: "/q", port: "8080", hostname: "localhost"…}
hash: ""
host: "localhost:8080"
hostname: "localhost"
href: "http://localhost:8080/q?start=5m-ago&ignore=275&m=avg:sys.cpu%257Bcpu=*,type=combined,host=tpmint%257D&o=&m=sum:1m-avg:rate:sys.fs.bytes%257Bdir=*,type=ext4,host=tpmint%257D&o=axis%2520x1y2&ylabel=CPU%2520Percent%2520Usage&y2label=File%2520System%2520Byte%2520Rate&yrange=%255B0:100%255D&y2range=%255B0:%255D&wxh=900x300&smooth=csplines&png"
origin: "http://localhost:8080"
password: ""
pathname: "/q"
port: "8080"
protocol: "http:"
search: "?start=5m-ago&ignore=275&m=avg:sys.cpu%257Bcpu=*,type=combined,host=tpmint%257D&o=&m=sum:1m-avg:rate:sys.fs.bytes%257Bdir=*,type=ext4,host=tpmint%257D&o=axis%2520x1y2&ylabel=CPU%2520Percent%2520Usage&y2label=File%2520System%2520Byte%2520Rate&yrange=%255B0:100%255D&y2range=%255B0:%255D&wxh=900x300&smooth=csplines&png"
username: ""

*/


/*
http://localhost:8080/q?
start=5m-ago&
ignore=1&

	m=avg:sys.cpu{cpu=*,type=combined,host=tpmint}&
	o=&

	m=sum:1m-avg:rate:sys.fs.bytes{dir=*,type=ext4,host=tpmint}&
	o=axis x1y2&
	ylabel=CPU Percent Usage&
	y2label=File System Byte Rate&

yrange=[0:100]&
y2range=[0:]&
wxh=900x300&
smooth=csplines&
png
*/
