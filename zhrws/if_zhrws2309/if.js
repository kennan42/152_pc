var MEAP = require("meap");
var path = require("path");

function run(Param, Robot, Request, Response, IF) {
    var arg = JSON.parse(Param.body.toString());
    var option = {
        wsdl: path.join(__dirname.replace(IF.name, ""), global.wsdl, "zhrws2309.xml"),
        func: "ZHRWS2309.ZHRWS2309_soap12.ZHRWS2309",
        Params: arg,
        BasicAuth: global.TXSOAPAuth
    };

    MEAP.SOAP.Runner(option, function(err, res, data) {
        Response.setHeader("Content-type", "text/json;charset=utf-8");
        if (!err) {
            Response.end(JSON.stringify(data));
        } else {
            Response.end(JSON.stringify({
                status: '-1',
                message: 'Error'
            }));
        }
    });
}

exports.Runner = run;
