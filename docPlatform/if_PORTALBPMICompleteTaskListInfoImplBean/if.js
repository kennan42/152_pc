var MEAP = require("meap");
var path = require("path");

function run(Param, Robot, Request, Response, IF) {
    var arg = JSON.parse(Param.body.toString());
    var option = {
        //wsdl:"http://cpq.cttq.com:52200/PORTAL_BPMI_CompleteTaskListInfo/PORTALBPMICompleteTaskListInfoImplBean?wsdl",
        wsdl : path.join(__dirname.replace(IF.name, ""), global.wsdl, "PORTALBPMICompleteTaskListInfoImplBean.xml"),
        func : "PORTAL_BPMI_CompleteTaskListInfo.PORTAL_BPMI_CompleteTaskListInfo_Port.PORTALBPMI_CompleteTaskListInfo",
        Params : arg,
        agent : false
    };

    MEAP.SOAP.Runner(option, function(err, res, data) {
        Response.setHeader("Content-type", "text/json;charset=utf-8");
        if (!err) {
            Response.end(JSON.stringify(data));
        } else {
            Response.end(JSON.stringify({
                status : '-1',
                message : 'Error'
            }));
        }
    });
}

exports.Runner = run;