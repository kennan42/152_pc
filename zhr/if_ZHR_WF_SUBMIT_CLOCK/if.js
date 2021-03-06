var MEAP=require("meap");
var path = require("path");

function run(Param,Robot,Request,Response,IF)
{
	var arg = JSON.parse(Param.body.toString());
	var clientUserId = arg.P_TJ_PERNR;
	var serverUserId = Robot.Get("username");
	if(clientUserId != serverUserId){
		Response.end(JSON.stringify({status:'-2',message:'invalide_userid'}));
		return;
	}
	var option={
		//wsdl:global.TX_DOMAIN_URL_PRE + "/sap/bc/srt/wsdl/flv_10002A111AD1/srvc_url/sap/bc/srt/rfc/sap/zhrws2208/800/zhrws2208/zhrws2208?sap-client=800",
		wsdl:path.join(__dirname.replace(IF.name,""),global.wsdl,"ZHR_WF_SUBMIT_CLOCK.xml"),
		func:"ZHRWS2208.ZHRWS2208_soap12.ZHRWS2208",
		Params:arg,
		BasicAuth:global.TXSOAPAuth
	};
	
	MEAP.SOAP.Runner(option,function(err,res,data){
		Response.setHeader("Content-type","text/json;charset=utf-8");
		if(!err)
		{
			Response.end(JSON.stringify(data));
		}
		else
		{
			Response.end(JSON.stringify({status:'-1',message:'Error'}));
		}
	});
}

exports.Runner = run;
