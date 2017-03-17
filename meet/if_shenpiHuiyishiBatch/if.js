var MEAP = require("meap");
var mongoose = require("mongoose");
var sm = require("../meetSchema.js");
var async = require("async");
var util = require("../../base/util.js");
var jpushUtil = require("../../jpush2/jpush_util.js");

/**
 * 批量审批会议室，用于统一代办模块
 * @author donghua.wang
 * @date 2015年11月6日 08:52
 * */
function run(Param, Robot, Request, Response, IF) {
    console.log("meet.shenpiHuiyishiBatch start");
    Response.setHeader("Content-Type", "text/json;charset=utf-8");
    var arg = JSON.parse(Param.body.toString());
   
    //var state = arg.state;
    //var userId = arg.userId;
    //var userName = arg.userName;
    var comments =arg.comments;
    var successCount = 0;
    var succe = [];
    var failCount = 0;
    var fails = [];
    var success =[];
    var conn = mongoose.createConnection(global.mongodbURL);
    var meetroomModel = conn.model("meetRoom", sm.MeetRoomSchema);
    var meetbookModel = conn.model("meetBook", sm.MeetBookSchema);
    var queue = async.queue(function(item, callback) {
        var meetbookId = item.scheduleId;
        var meetroomId = item.meetRoomId;
        var meetroom = null;
        var meetbook = null;
        meetbookModel.findById(meetbookId, function(err, doc) {
            meetbook = doc;
             console.log("------------------------"); 
            var startDate = util.getMMddHHmmFromTimes(doc.startTime); 
            var startTime = doc.startTime;
            var endTime = doc.endTime; 
            if (item.state == 2) {//审核通过
                var checkState = 1;
                async.series([
                //判断会议室状态是否正常
                function(cb) {
                     console.log("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"); 
                    meetroomModel.findById(meetroomId, function(err, doc) {
                        meetroom = doc;
                        if (doc.state == 3 || doc.state == 4) {//会议室停用或者删除
                            checkState = 0;
                            failCount++;
                            fails.push({"meetbookId":meetbookId,"msg":"停用"});
                        }
                        if (doc.state == 2 && doc.frozenBegin < endTime && doc.frozenEnd > startTime) {//会议室冻结
                            checkState = 0;
                            failCount++;
                            fails.push({"meetbookId":meetbookId,"msg":"冻结"});
                        } 
                        if(item.state == 6 && doc.startTime > new Date().getTime()){
                            checkState = 0;
                            failCount++;
                             fails.push({"meetbookId":meetbookId,"msg":"该会议已经开始"});
                            }
                            console.log("值得状态："+checkState);
                        cb(null, "");
                    });
                }, 
                function(cb) {
                    if (checkState == 1) {
                        console.log("cccccccccccccccccccccccccccccc"); 
                        var update = {
                            state : 2,
                            checkTime : new Date().getTime(),
                            examineUser : [{
                            userId :item.userId,
                            userName :item.userName
                           }],
                          comments:comments
                        }; 
                         update.servicePersonal = (item.servicePersonal==null?[]:item.servicePersonal);
                         update.technicist = (item.technicist==null?[]:item.technicist); 
                        meetbookModel.update({
                            "_id" : meetbookId
                        }, update, function(err) {
                            if(!err){
                                successCount++;
                                succe.push({"meetbookId":meetbookId,"msg":"审批成功,同意"}); 
                            }else{
                               failCount++;
                               fails.push({"meetbookId":meetbookId,"msg":"修改失败"});  
                            } 
                            cb(null, null);
                        });
                    } else {  
                        cb(null, "");
                    }
                }], function(err, rs) {
                    if (checkState == 1) {
                        pushMsg2ApplyPerson(item.userId, item.state, meetbook, meetroom, meetroomId);
                        pushMsg2ServicePerson(item.userId, meetbook, meetroom)
                    }
                    callback(null, "");
                });
                } else {//不通过
                console.log("不通过");
                   var update = {
                            state : 3,
                            checkTime : new Date().getTime(),
                            examineUser : [{
                            userId :item.userId,
                            userName :item.userName
                           }],
                           comments:comments
                        };
                meetbookModel.update({
                    "_id" : meetbookId
                }, update, function(err) {
                    if(!err){
                        successCount++;
                     succe.push({"meetbookId":meetbookId,"msg":"审批成功,拒绝"}); 
                    }else{
                      failCount++;
                      fails.push({"meetbookId":meetbookId,"msg":"修改失败"});    
                    } 
                    pushMsg2ApplyPerson(item.userId, item.state, meetbook, meetroom, meetroomId);
                    callback(null, "");
                });
            }
        }); 
    }, 30);
    queue.drain = function() {
        conn.close();
        Response.end(JSON.stringify({
            "status" : "0",
            "failCount" : failCount,
            "successCount" : successCount,
            "succe":succe,
            "fails":fails
        }));
    }
    var meetbooks = arg.meetbooks;
    for (var i in meetbooks) {
        queue.push(meetbooks[i]);
    }

}

/*将审核结果推送给申请人
 * 
 */
function pushMsg2ApplyPerson(userId, state,meetbook, meetroom, meetroomId) {
    var conn = mongoose.createConnection(global.mongodbURL);
    var meetroomModel = conn.model("meetRoom", sm.MeetRoomSchema);
    meetroomModel.findById(meetroomId, function(err, doc) {
        conn.close();
        var userIds = [];
        userIds.push(meetbook.userId);
        var startDate = util.getMMddHHmmFromTimes(meetbook.startTime);
        var state = state;
        var subModule = "";
        var title = "";
        if (state == 2) {
            title = "您" + startDate + "开始" + doc.name + "进行的会议已审核通过啦。";
            subModule = "MeetingRoomApplyComplete";
        } else {
            title = "您" + startDate + "开始" + doc.name + "进行的会议已被驳回，可以继续预定其他会议室或会议时间哦。";
            subModule = "OffMeetingRoom";
        }
        var pushArg = {
            appId : global.appId,
            platforms : "0,1",
            title : title,
            body : new Date().getTime() + "_" + subModule,
            userIds : userIds,
            badgeNum : 3,
            module : "MeetingRoomBooking",
            subModule : subModule,
            type : "remind"
        };
        var jpushArg = {
            userid : userId,
            userList : userIds,
            title : "",
            content : pushArg.title,
            type : 0,
            msgType : "MeetingRoomBooking",
            subModule : subModule
        };
        if (global.pushType == "emm") {
            util.pushMsg(pushArg);
        } else {
            jpushUtil.jpush(jpushArg);
        }
    });
    //pushMsg2participants(state, meetbook, meetroom);
}

function pushMsg2ServicePerson(userId, meetbook, meetroom) {
    if (meetroom.servicePersonal != null && meetroom.servicePersonal.length > 0) {
        var persons = meetroom.servicePersonal;
        var userIds = [];
        for (var i in persons) {
            var userId = persons[i].userId;
            userIds.push(userId);
        }
        var pushArg = {
            appId : global.appId,
            platforms : "0,1",
            title : "有一场" + util.getMMddHHmmFromTimes(meetbook.startTime) + "开始" + meetroom.name + "进行的会议需要亲服务支持哦，请及时查看。",
            body : new Date().getTime() + "_ChangeMeetingRoomManager",
            userIds : userIds,
            badgeNum : 3,
            module : "MeetingRoomBooking",
            subModule : "ChangeMeetingRoomManager",
            type : "remind"
        };
        var jpushArg = {
            userid : userId,
            userList : userIds,
            title : "",
            content : pushArg.title,
            type : 0,
            msgType : "MeetingRoomBooking",
            subModule : "ChangeMeetingRoomManager"
        };
        if (global.pushType == "emm") {
            util.pushMsg(pushArg);
        } else {
            jpushUtil.jpush(jpushArg);
        }
    }
    pushMsg2technicist(arg, meetbook, meetroom);
}

function pushMsg2technicist(arg, meetbook, meetroom) {
    if (meetroom.technicist != null && meetroom.technicist.length > 0) {
        var persons = meetroom.technicist;
        var userIds = [];
        for (var i in persons) {
            var userId = persons[i].userId;
            userIds.push(userId);
        }
        var pushArg = {
            appId : global.appId,
            platforms : "0,1",
            title : "有一场" + util.getMMddHHmmFromTimes(meetbook.startTime) + "开始" + meetroom.name + "进行的会议需要亲服务支持哦，请及时查看。",
            body : new Date().getTime() + "_ChangeMeetingRoomManager",
            userIds : userIds,
            badgeNum : 3,
            module : "MeetingRoomBooking",
            subModule : "ChangeMeetingRoomManager",
            type : "remind"
        };
        var jpushArg = {
            userid : arg.userId,
            userList : userIds,
            title : "",
            content : pushArg.title,
            type : 0,
            msgType : "MeetingRoomBooking",
            subModule : "ChangeMeetingRoomManager"
        };
        if (global.pushType == "emm") {
            util.pushMsg(pushArg);
        } else {
            jpushUtil.jpush(jpushArg);
        }
    }
    
}
/**
 *  
 * @param {Object} arg
 * @param {Object} state
 * @param {Object} meetbook
 * @param {Object} meetroom
 */
function pushMsg2participants(arg, state, meetbook, meetroom) {
     if (meetroom.participants != null && meetroom.participants.length > 0) {
          var persons = meetbook.participants;
          var userIds = [];
          var startDate = util.getMMddHHmmFromTimes(meetbook.startTime);
          for (var i in persons) {
              var userId = persons[i].userId;
              userIds.push(userId);
          }
          var title = "";
           if (state == 2) {
              title = "您" + startDate + "开始" + meetbook.name + "进行的会议已审核通过啦。";
              subModule = "MeetingRoomApplyComplete";
          } else {
              title = "您" + startDate + "开始" + meetbook.name + "进行的会议已被驳回，可以继续预定其他会议室或会议时间哦。";
              subModule = "OffMeetingRoom";
          }
          var pushArg = {
              appId : global.appId,
              platforms : "0,1", 
              title : title, 
              body : new Date().getTime() + "_ChangeMeetingRoomManager",
              userIds : userIds,
              badgeNum : 3,
              module : "MeetingRoomBooking",
              subModule : subModule,
              type : "remind"
          };
          var jpushArg = {
              userid : arg.userId,
              userList : userIds,
              title : "",
              content : pushArg.title,
              type : 0,
              msgType : "MeetingRoomBooking",
              subModule : "ChangeMeetingRoomManager"
          };
          if (global.pushType == "emm") {
              util.pushMsg(pushArg);
          } else {
              jpushUtil.jpush(jpushArg);
          }
      } 
}
 
exports.Runner = run;

