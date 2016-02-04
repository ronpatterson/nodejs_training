// bugtrack.js (node.js version)
//
// Ron Patterson, WildDog Design

// some utility functions
if (typeof(String.trim) == 'undefined')
{
	String.prototype.trim = function()
	{
		return this.replace(/^\s+/,'').replace(/\s+$/,'');
	}
}

if (typeof(String.blank) == 'undefined')
{
	String.prototype.blank = function()
	{
		return /^\s*$/.test(this);
	}
}

var bt = // setup the bt namespace
{

	login_content: { 'uid': 'rlpatter' },
	stimer: 0,
	group_def: 'WDD', // default group
	group_data: {},
	bug_doc: {},

	check_session: function (event)
	{
		var params = "action=bt_check_session";
		$.ajax({
			url: 'bt_check_session',
			type: 'post',
			data: params,
			dataType: 'html'
		}).done(function (response)
		{
			if (response == 0)
			{
				if (bt.stimer != 0) window.clearInterval(bt.stimer);
				bt.stimer = 0;
				bt.login_form();
			}
			else
			{
				$('#bt_user_heading').show();
			}
		});
		return false;
	},

	login_form: function (event)
	{
		if (bt.stimer != 0) window.clearInterval(bt.stimer);
		bt.stimer = 0;
		$('#bt_user_heading').hide();
		$('#bt_login_form input[type="password"]').val('');
		$('#dialog-login').dialog({
			width: 400,
			maxHeight: 700,
			modal: true,
			title: 'BugTrack Login',
			show: 'fade',
			hide: 'fade',
			draggable: false,
			resizeable: false,
			closeOnEscape: false,
			dialogClass: "no-close"
			//beforeClose: function( event, ui ) {return false;}
		});
		$('#login_errors').html('');
		$('#bt_login_form').on('submit',bt.login_handler);
		$('input[name="uid"]').focus();
		return false;
	},

	login_handler: function (event)
	{
		var params = "action=bt_login_handler";
		params += '&'+$('#bt_login_form').serialize();
		$.ajax({
			url: 'bt_login_handler',
			type: 'post',
			data: params,
			dataType: 'html'
		}).done(function (response)
		{
			if (/FAIL/.test(response))
			{
				$('#login_errors').html(response);
				return false;
			}
			else
			{
				var row = $.parseJSON(response);
				$('#dialog-login').dialog('close');
// 					var user = $('<div></div>')
// 						.css('position','absolute')
// 						.css('width','30em')
// 						.css('top','15px')
// 						.css('right','1em')
// 						.css('text-align','right')
// 						.css('font-size','9pt')
// 						.html('Welcome '+row.fname+' '+'<a href="#" onclick="return bt.logout_handler();">Logout</a>');
// 					$('body').append(user);
				$('#bt_user_name_top').html(row.fname+' '+row.lname);
				$('#bt_user_heading').show();
				$('#bt_admin_btn').show();
				if (!/admin/.test(row.roles)) $('#bt_admin_btn').hide();
				bt.stimer = window.setInterval(bt.check_session,300000);
			}
		});
		return false;
	},

	logout_handler: function (event)
	{
		var params = "action=bt_logout_handler";
		$.ajax({
			url: 'bt_logout_handler',
			type: 'post',
			data: params,
			dataType: 'html'
		});
		window.setTimeout(bt.check_session,1000); // a bit of a delay
		return false;
	},

	buglist: function ( event, type )
	{
		//console.log(event,type);
		var type2 = type ? type : '';
		var sel_val = {};
		if (type2 == 'bytype')
		{
			//sel_val = " and bug_type = '"+$('select[name="bug_type2"]').val()+"'";
			sel_val = {"bug_type": $('select[name="bug_type2"]').val()};
		}
		if (type2 == 'bystatus')
		{
			//sel_val = " and b.status = '"+$('select[name="status2"]').val()+"'";
			sel_val = {"status": $('select[name="status2"]').val()};
		}
		//$('#content_div').html(response);
		$('#content_div').show();
		bt.buglist2(event, type2, sel_val);
		return false;
	},

	buglist2: function ( event, type, sel_arg )
	{
		//console.log(event,type,sel_arg);
		var params = {
			'action': 'list2',
			'type': type,
			'sel_arg': JSON.stringify(sel_arg)
		};
		$('#bt_tbl tbody').off( 'click', 'button');
		var table = $('#bt_tbl').DataTable({
			'ajax': {
				'url': 'bug_list',
				'type': 'get',
				'data': params
			},
			'destroy': true,
			'order': [[ 0, "asc" ]],
			'columns': [
				{'data': 'bug_id'},
				{'data': 'descr'},
				{'data': 'entry_dtm'},
				{'data': 'status'},
				null
			],
			'columnDefs': [ {
				'targets': -1,
				'data': null,
				'defaultContent': '<button>Show</button>'
			} ]
		});
		$('#bt_tbl tbody').on( 'click', 'button', function () {
			var data = table.row( $(this).parents('tr') ).data();
			//alert( 'id='+data[4]);
			bt.bugshowdialog(event,data._id);
		} );
		$('#bt_bugs_list').show();
		return false;
	},

	bugadd: function ( event )
	{
		bt.showDialogDiv('BugTrack Bug Add','bt_bugs_show_edit');
		$('#bugedit_errors').html('');
		$('#bugedit_form1 input[type="text"]').val('');
		$('#bugedit_form1 textarea').val('');
		$('#euser').html(bt.login_content.uid);
		$('input[name="bid"]').val('');
		$('select[name="bt_group"]').val(bt.group_def);
		$('select[name="bug_type"]').val('');
		$('select[name="status"]').val('o');
		$('#assignedDiv2').html('');
		$('#bt_assign_btn2').hide();
		$('select[name="priority"]').val('3');
		$('#filesDiv,#bfiles,#assignedDiv').html('');
		$('.bt_date').html('');
		$('#bugshow_div').hide();
		$('#bugedit_div').show();
		return false;
	},

	edit_bug: function ( event, id )
	{
		var id2 = $('#bid').val();
		if (id) id2 = id;
		//alert('edit_bug '+id2);
		var params = "action=edit&id="+id2;
		$.ajax({
			url: 'bug_get',
			type: 'get',
			data: params,
			dataType: 'json'
		}).done(function (data)
		{
			//$('#content_div').html(response);
			//$('#bugshow_div').dialog('close');
			//bt.showDialogDiv('BugTrack Bug '+data.bug_id,'bt_bugs_show_edit');
			$('#bugedit_errors').html('');
			$('#bugedit_id').html(data.bug_id);
			$('#oldstatus').val(data.status);
			var grp = data.bug_id.replace(/\d+$/,'');
			$('select[name="bt_group"]').val(grp);
			$('input[name="descr"]').val(data.descr);
			$('input[name="product"]').val(data.product);
			$('select[name="bug_type"]').val(data.bug_type);
			$('select[name="status"]').val(data.status);
			$('select[name="priority"]').val(data.priority);
			$('#assignedDiv2').html(data.aname);
			$('#bt_assign_btn2').show();
			$('textarea[name="comments"]').val(data.comments);
			$('textarea[name="solution"]').val(data.solution);
			$('#edtm').html(data.edtm);
			$('#udtm').html(data.udtm);
			$('#cdtm').html(data.cdtm);
// 			$('#bdate').datepicker(
// 			{
// 				yearRange: '-80:+1',
// 				changeMonth: true,
// 				changeYear: true
// 			});
			$('#bugshow_div').hide();
			$('#bugedit_div').show();
		});
		return false;
	},
	
	bugshowdialog: function ( event, id )
	{
		bt.showDialogDiv('BugTrack Bug','bt_bugs_show_edit');
		bt.bugshow(event,id);
		return false;
	},

	bugshow: function ( event, id )
	{
		//alert(id);
		//var id2 = parseInt(id.replace(/[^\d]/g,''));
		var params = "action=show&id="+id;
		$.ajax({
			url: 'bug_get',
			type: 'get',
			data: params,
			dataType: 'json'
		}).done(function (data)
		{
			//console.log(data);
			bt.bug_doc = data;
			$('#bt_bugs_show_edit').dialog('option','title','BugTrack Bug '+data.bug_id);
			var group_cd = data.bug_id.replace(/\d+$/,'');
			$('#bt_admin_errors').html('');
			$('#bug_id').val(data.bug_id);
			$('#bug_id2_v').html(data.bug_id);
			$('#bid').val(id);
			$('#group_v').html(bt.get_lookup(bt.group_data.bt_group,group_cd));
			$('#descr_v').html(data.descr);
			$('#product_v').html(data.product);
			$('#bt_v').html(bt.get_lookup(bt.group_data.bt_type,data.bug_type));
			$('#status_v').html(data.status_descr);
			$('#priority_v').html(data.priority_descr);
			$('#assignedDiv1').html(data.aname);
			$('#comments_v').html(data.comments);
			$('#solution_v').html(data.solution);
			$('#ename_v').html(data.ename);
			$('#edtm_v').html(data.edtm);
			$('#udtm_v').html(data.udtm);
			$('#cdtm_v').html(data.cdtm);
			bt.get_files(event);
			bt.worklog_show(event,data);
			bt.bug_save_cancel();
			$('#bugshow_div').show();
		});
		return false;
	},

	worklog_show: function ( event, data )
	{
		$('#bt_worklog_div').empty();
		var div = $('#bt_worklog_div');
		if (!data.worklog || data.worklog.length == 0)
			div.html('No worklog records');
		else
		{
			var tbl = $('<table></table>');
			div.append(tbl);
			var wl = data.worklog;
			for (var x=0; x<wl.length; ++x)
			{
			    var uname = bt.group_data.users[wl[x].user_nm] ? bt.group_data.users[wl[x].user_nm].name : 'n/a';
				var tr = $('<tr><th>Date/Time: '+wl[x].edtm+' by '+uname+'</th></tr>');
				div.append(tr);
				tr = $('<tr><td>'+bt.nl2br(wl[x].comments)+'<hr></td></tr>');
				div.append(tr);
			}
		}
	},

	bug_save_cancel: function( event )
	{
		$('#bugshow_div').show();
		$('#bugedit_div').hide();
		return false;
	},

	bughelp: function ( event )
	{
		bt.showDialogDiv('BugTrack Help','bughelp_div');
		return false;
	},

	bughandler: function( event )
	{
		//alert('bughandler '+$('#bugedit_form1').serialize()); return false;
		var err = bt.validate();
		if (err != '')
		{
			$('#bugedit_errors').html('Errors encountered:<br>'+err);
			return false;
		}
		$('#bugedit_errors').html('');
		var params = 'action=add_update&'+$('#bugedit_form1').serialize();
		params += '&id='+$('#bid').val();
		params += '&bug_id='+$('#bug_id').val();
		params += '&user_id='+$('#userid').val();
		//alert('bughandler '+params);
		$.ajax({
			url: 'bug_add_update',
			type: 'post',
			data: params,
			dataType: 'html'
		}).done(function (response)
		{
			if (!/SUCCESS/.test(response))
			{
				$('#bugedit_errors').html(response);
			}
			else
			{
				bt.buglist(event);
				if ($('#bid').val() == '') bt.bug_save_cancel();
				else bt.bugshow(event,$('#bid').val());
				//$('#bt_bugs_list_edit').dialog('close');
				//window.setTimeout(function(e) {$('#bugedit_div').dialog('close');},3000);
			}
		});
		return false;
	},

	delete_bug: function ( event )
	{
		if (!confirm("Really delete this entry?")) return false;
		var params = 'action=delete';
		params += '&id='+$('#bid').val();
		$.ajax({
			url: 'bug_delete',
			type: 'post',
			data: params,
			dataType: 'html'
		}).done(function (response)
		{
			if (/^SUCCESS/.test(response))
			{
				$('#bt_bugs_show_edit').dialog('close');
				bt.buglist(event);
			}
			else
				alert(response);
		});
		return false;
	},

	assign_search: function ( event )
	{
		//alert('assign_search');
		bt.showDialogDiv('BugTrack Assign','bt_users_search', 700);
		return false;
	},

	handle_search: function ( event )
	{
		$('#bt_user_assign_tbl tbody').off( 'click', 'button');
		var f = document.bt_form9;
		var table = $('#bt_user_assign_tbl').DataTable({
			'ajax': {
				'url': 'admin_users',
				'type': 'get',
				'data': {
					'action': 'getUsersSearch',
					'lname': f.lname.value,
					'fname': f.fname.value
				}
			},
			'destroy': true,
			'order': [[ 0, "asc" ]],
			'columns': [
				{'data': 'uid'},
				{'data': 'name'},
				{'data': 'email'},
				{'data': 'roles'},
				{'data': 'active'},
				null
			],
			'columnDefs': [ {
				'targets': -1,
				'data': null,
				'defaultContent': '<button>Select</button>'
			} ]
		});
		$('#bt_user_assign_tbl tbody').on( 'click', 'button', function () {
			var data = table.row( $(this).parents('tr') ).data();
			//alert( 'user='+data[0]);
			bt.assign_user(event,data.uid);
		} );
		return false;
	},

	assign_user: function ( event, user )
	{
		var id = $('#bid').val();
		var params = 'action=assign_user';
		params += '&id='+id;
		params += '&uid='+user;
		$.ajax({
			url: 'assign_user',
			type: 'post',
			data: params,
			dataType: 'html'
		}).done(function (response)
		{
			$('#bt_users_search').dialog('close');
			bt.bugshow(event,id);
		});
		return false;
	},

	add_worklog: function ( event ) {
		bt.showDialogDiv('BugTrack Worklog','bt_worklog_form');
		$('#bt_wl_bug_id').html($('#bug_id2_v').text());
		$('#bt_wl_descr').html($('#descr_v').html());
		$('#bt_bug_comments').html($('#comments_v').html());
		$('input[name="wl_public"][value="n"]').prop('checked',true);
		$('textarea[name="wl_comments"]').val('');
		$('#bt_wl_ename').html($('#usernm').html());
		$('#bt_wl_entry_dtm').html($('#edtm_v').html());
		$('#wl_errors').html('');
		$('textarea[name="wl_comments"]').focus();
		return true;
	},

	workloghandler: function( event ) {
		//alert('workloghandler '+$('#bt_form2').serialize()); return false;
		//var err = bt.validate();
		var err = '';
		if ($('textarea[name="wl_comments"]').val().blank())
			err += ' - Worklog Comments must not be blank<br>';
		if (err != '')
		{
			$('#wl_errors').html('Errors encountered:<br>'+err);
			return false;
		}
		var id = $('#bid').val();
		var params = 'action=worklog_add&'+$('#bt_form2').serialize();
		params += '&usernm='+$('#userid').val();
		params += '&id='+id;
		params += '&bug_id='+$('#bug_id').val();
		//alert('workloghandler '+params);
		$.ajax({
			url: 'worklog_add',
			type: 'post',
			data: params,
			dataType: 'html'
		}).done(function (response)
		{
			if (/^SUCCESS/.test(response))
			{
				$('#bt_worklog_form').dialog('close');
				bt.bugshow(event,$('#bid').val());
				//window.setTimeout(function(){bt.bugshow(event,id);},200);
			}
			else
				$('#wl_errors').html(response);
		});
		return false;
	},

	get_worklog: function (id) {
		$('#worklogDiv').html("Loading...");
		//alert("search_list called");
		$('#worklogDiv').load('bugworklogAjax.php', { id: id });
		return false;
	},

	get_files: function ( event )
	{
		$('#filesDiv').empty();
        var out = '';
        var data = typeof(bt.bug_doc.attachments) == 'object' ? bt.bug_doc.attachments : [];
        if (data.length == 0)
            out = 'No attachments';
        else
        {
            $.each(data,function (i)
            {
                var id = $('#bid').val();
                out += '<a href="src/get_file.html?id='+id+'&idx='+i+'" target="_blank">'+data[i].file_name+'</a> ('+data[i].file_size+') <span onclick="return bt.remove_file(\''+id+'\','+i+');" style="cursor: pointer;">Remove</span><br>';
            });
        }
        $('#filesDiv').html(out);
	},

	attach_file: function ( event )
	{
		//$('errors').update();
		$('#update_list').val("0");
		//alert("add_file called");
//		w = window.open('views/add_file.html?id='+$('#bid').val()+'&bug_id='+$('#bug_id').val(), 'Add_file', 'width=620,height=280,resizable,menubar,scrollbars');
		w = window.open('src/add_file.html?id='+$('#bid').val()+'&bug_id='+$('#bug_id').val(), 'Add_file', 'width=620,height=280,resizable,menubar,scrollbars');
		//setTimeout("watch_add(w)",2000);
		bt.get_files(event);
		return false;
	},

	remove_file: function ( id, idx )
	{
		if (!confirm('Really remove this attachment file?')) return false;
		var params = 'action=remove_file';
		params += '&id='+id;
		params += '&idx='+idx;
		$.ajax({
			url: 'attachment_delete',
			type: 'post',
			data: params,
			dataType: 'html'
		}).done(function (response)
		{
			console.log(response);
    		bt.get_files(null);
		});
		return false;
	},

	show_email: function ( event ) {
		bt.showDialogDiv('BugTrack Email','bt_email_div');
		$('#bug_id_email').html($('#bug_id2_v').text());
		$('#descr_email').html($('#descr_v').html());
		$('input[name="subject"]').val($('#bug_id2_v').text()+' - '+$('#descr_v').html());
		$('#email_errors').html('');
		return true;
	},

	email_bug: function (e) {
		var err = '';
		if ($('input[name="sendto"]').val().blank())
			err += ' - Send To must not be blank<br>';
		if ($('input[name="subject"]').val().blank())
			err += ' - Subject must not be blank<br>';
		if (err != '')
		{
			$('#email_errors').html('Errors encountered:<br>'+err);
			return false;
		}
		var params = 'action=email_bug';
		params += '&id='+$('#bid').val();
		params += '&bug_id='+$('#bug_id').val();
		params += '&'+$('#bug_email_form').serialize();
		$.ajax({
			url: 'bug_email',
			type: 'post',
			data: params,
			dataType: 'html'
		}).done(function (response)
		{
			$('#email_errors').html(response);
		});
		return false;
	},

	validate: function ( )
	{
		var datere = /^[01][0-9]\/[0-3][0-9]\/(19|20)[0-9]{2}$/;
		var err = '';
		var f = document.bt_form1;
		if (f.descr.value.blank())
			err += ' - Description must not be blank<br>';
		if (f.product.value.blank())
			err += ' - Product or Application must not be blank<br>';
		if (f.bug_type.value.blank())
			err += ' - Bug Type must be selected<br>';
		if (f.comments.value.blank())
			err += ' - Comments must not be blank<br>';
	// 	if (!datere.test($('#bdate').val()))
	// 		err += ' - Birth date is not valid (mm/dd/yyyy)<br>';
		return err;
	},

	bugadmin: function ( event )
	{
		bt.showDialogDiv('BugTrack Admin','bt_users_admin',700);
		$('#bt_admin_users_add').on('click',bt.user_add);
		bt.bugadmin_users();
		return false;
	},

	bugadmin_users: function ( event )
	{
		$('#bt_user_tbl tbody').off( 'click', 'button');
		$.ajax({
			url: 'admin_users',
			type: 'get',
			dataType: 'json'
		}).done(function (data)
		{
            var table = $('#bt_user_tbl').DataTable({
                'data': data.data,
                'destroy': true,
                'order': [[ 0, "asc" ]],
                'columns': [
                    {'data': 'uid'},
                    {'data': 'name'},
                    {'data': 'email'},
                    {'data': 'roles'},
                    {'data': 'active'},
                    null
                ],
                'columnDefs': [ {
                    'targets': -1,
                    'data': null,
                    'defaultContent': '<button>Edit</button>'
                } ]
            });
            $('#bt_user_tbl tbody').on( 'click', 'button', function () {
                var data = table.row( $(this).parents('tr') ).data();
                //alert( 'user='+data[0]);
                //console.log(data);
                bt.user_show(event,data.uid);
            } );
		});
		$('#bt_users_list').show();
		$('#bt_users_form').hide();
		return false;
	},

	user_add: function ( event )
	{
		//bt.showDialogDiv('User Add','bt_users_form');
		$('#bt_admin_errors').html('');
		$('#bt_users_form input[type="text"]').val('');
		$('input[name="pw"]').val('');
		$('input[name="pw2"]').val('');
		$('input[name="uid1"]').val('');
		$('input[name="uid1"]').removeAttr('readonly');
		$('input[name="uid"]').val('');
		$('input[name="id"]').val('');
		$('input[name="active"]').removeAttr('checked');
		$('input[name="active"][value="y"]').prop('checked',true);
		$('input[name="roles"]').removeAttr('checked');
		$('input[name="roles"][value="user"]').prop('checked',true);
		$('select[name="bt_group"]').val('');
		$('#bt_users_list').hide();
		$('#bt_users_form').show();
	},

	user_show: function ( event, uid )
	{
		uid2 = !uid ? '' : uid;
		var params = "action=bt_user_show";
		params += '&uid='+uid2;
		$.ajax({
			url: 'user_get',
			type: 'get',
			data: params,
			dataType: 'json'
		}).done(function (data)
		{
			//console.log(data);
			//bt.showDialogDiv('User Edit','bt_users_form');
			//$('#bt_user_form_id').on('submit',bt.userhandler);
			$('#bt_admin_errors').html('');
			$('input[name="uid"]').val(uid);
			$('input[name="id"]').val(data._id);
			$('input[name="uid1"]').val(uid);
			$('input[name="uid1"]').attr('readonly',true);
			$('input[name="lname"]').val(data.lname);
			$('input[name="fname"]').val(data.fname);
			$('input[name="email"]').val(data.email);
			$('input[name="active"]').removeAttr('checked');
			if (data.active == 'y') $('input[name="active"][value="y"]').prop('checked',true);
			else $('input[name="active"][value="n"]').prop('checked',true);
			$('input[name="roles"]').removeAttr('checked');
			if (data.roles == 'admin') $('input[name="roles"][value="admin"]').prop('checked',true);
			else if (data.roles == 'ro') $('input[name="roles"][value="ro"]').prop('checked',true);
			else $('input[name="roles"][value="user"]').prop('checked',true);
			$('input[name="pw"]').val(data.pw);
			$('input[name="pw2"]').val(data.pw);
			$('select[name="bt_group"]').val(data.bt_group);
		});
		$('#bt_users_list').hide();
		$('#bt_users_form').show();
		return false;
	},

	user_save_cancel: function( event )
	{
		$('#bt_users_list').show();
		$('#bt_users_form').hide();
		return false;
	},

	userhandler: function( event ) {
		//alert('userhandler '+$('#bt_user_form_id').serialize());
		var emailre = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,6})+$/;
// 		var err = bt.validate();
		var f = document.bt_user_form;
		var err = '';
		if (f.uid1.value.blank())
			err += " - UID must not be blank<br>";
		if (f.lname.value.blank())
			err += " - Last Name must not be blank<br>";
		if (!emailre.test(f.email.value))
			err += ' - Email is not valid<br>';
		if (f.bt_group.value.blank())
			err += " - Group must be selected<br>";
		if (err != '')
		{
			$('#bt_admin_errors').html('Errors encountered:<br>'+err);
			return false;
		}
		var params = 'action=user_add_update';
		params += '&'+$('#bt_user_form_id').serialize();
		//alert('userhandler '+params); return false;
		$.ajax({
			url: 'user_add_update',
			type: 'post',
			data: params,
			dataType: 'html'
		}).done(function (response)
		{
			$('#bt_admin_errors').html(response);
			bt.bugadmin_users(event);
		});
		return false;
	},

	assign_locate: function ( file )
	{
		$.get(
			file,
			function (response)
			{
				bt.showDialog('BugTrack Maintenance',response);
			}
		);
		return false;
	},

	showDialog: function ( title, content )
	{
		//if ($('#dialog-modal').dialog) $('#dialog-modal').dialog('destroy');
		$('#dialog-content').html(content);
		$('#dialog-modal').dialog({
		  width: 600,
		  maxHeight: 700,
		  modal: true,
		  title: title,
		  show: 'fade',
		  hide: 'fade',
		  close: function (e,ui)
		  {
			$(this).dialog('destroy');
		  }
		});
	},

	showDialogDiv: function ( title, div, width )
	{
		//alert('showDialogDiv');
		var w = width ? width : 600;
		$('#'+div).dialog({
		  width: w,
		  maxHeight: 700,
		  modal: true,
		  title: title,
		  show: 'fade',
		  hide: 'fade',
		  close: function (e,ui)
		  {
		  	$('#'+div+' > div.bugform').hide();
			$(this).dialog('destroy');
		  }
		});
	},

	bugCancelDialog: function ( event )
	{
		if ($('#bugedit_id').text() == '')
			$('#bt_bugs_show_edit').dialog('close');
		else
		{
			$('#bugshow_div').show();
			$('#bugedit_div').hide();
		}
		bt.buglist();
	},

	worklogCancelDialog: function ( event )
	{
		$('#bt_worklog_form').dialog('close');
		bt.buglist();
	},

	nl2br: function ( val )
	{
		return val.replace(/\r?\n/g,'<br>');
	},

	/**
	 * @param name string
	 * @param data array({val,text},...);
	 */
	build_selection: function ( name, data )
	{
		//debugger;
		var obj = $('<select></select>').attr('name',name);
		var opt = $('<option></option>').attr('value','').html('--Select One--');
		obj.append(opt);
		for (var i=0; i<data.length; ++i)
		{
			if (typeof(data[i]) != 'object')
				rec = { 'cd': i, 'descr': data[i] };
			else
				rec = data[i];
			var opt = $('<option></option>').attr('value',rec.cd).html(rec.descr);
			obj.append(opt);
		}
		//console.log(obj);
		return obj;
	},

	get_lookup: function ( group, cd )
	{
		//debugger;
		var descr = '';
		for (var i=0; i<group.length; ++i)
		{
			var item = group[i];
			if (cd == item.cd)
			{
				return item.descr;
			}
		}
		return 'n/a';
	},

	init: function ( )
	{
		$('#bt_refresh_btn').button();
		$('#bt_refresh_btn').on('click',bt.buglist);
		$('#bt_add_btn').button();
		$('#bt_add_btn').on('click',bt.bugadd);
		$('#bt_admin_btn').button();
		$('#bt_admin_btn').on('click',bt.bugadmin);
		$('#bt_help_btn').button();
		$('#bt_help_btn').on('click',bt.bughelp);
		$('#bugedit_form1').on('submit',bt.bughandler);
		$('#bt_form2').on('submit',bt.workloghandler);
		$('#bt_form9').on('submit',bt.handle_search);
		$('#bug_email_form').on('submit',bt.email_bug);
		$('#cancel2').on('click',bt.worklogCancelDialog);
		$('#bt_bug_edit_cancel').on('click',bt.bugCancelDialog);
		$('#bt_user_form_id').on('submit',bt.userhandler);
		$('#bt_user_save_cancel').on('click',bt.user_save_cancel);
		$('#bt_show_buttons span').button();
		$('#bt_admin_btn').show();
		var params = 'action=bt_init';
		$.ajax({
			url: 'bt_init',
			type: 'get',
			data: params,
			dataType: 'json'
		}).done(function (data)
		{
			//console.log(data);
			bt.group_data = data;
			var sel = bt.build_selection('bt_group',data.bt_group);
			$('#bt_groups').empty().append(sel);
			var sel = bt.build_selection('bt_group',data.bt_group);
			$('#bt_grp').empty().append(sel);
			var sel = bt.build_selection('bug_type',data.bt_type);
			$('#btypes_s').empty().append(sel);
			var sel = bt.build_selection('status',data.bt_status);
			$('#status_s').empty().append(sel);
			var sel = bt.build_selection('priority',data.bt_priority);
			$('#priority_s').empty().append(sel);
			var sel = bt.build_selection('bug_type2',data.bt_type);
			$('#btc_types').empty().append(sel);
			var sel = bt.build_selection('status2',data.bt_status);
			$('#btc_status').empty().append(sel);
			if (!/admin/.test(bt.group_data.roles)) $('#bt_admin_btn').hide();
		});
	}

} // end of bt namespace

$(function ()
{
	$( document ).ajaxError(function(event, jqxhr, settings, thrownError) {
		bt.showDialog( "ERROR!", "A error occurred during server call.<br>" + thrownError );
	});
	bt.init();
	//login_content = $('#login_content').html();
	//$('#login_content').html('');
	//bt.check_session();
});
