define(['exports', 'app/loading', 'app/config', 'app/layout', 'app/site', 'app/tree', 'app/tabs', 'app/prompt', 'app/lang', "ui.basicMenu", 'diff2html/diff2html', 'diff2html/diff2html-ui'], function (exports, loading, config, layout, site, tree, tabs, prompt) {
var lang = require('app/lang').lang;
var gitEditor;

function init() {
	$('#tabs-git').append('<div class="vbox">\
		<p id="notAvailable" class="flex" style="text-align:center; color:#ccc;">Git panel will appear here</p>\
		<div id="gitContainer" class="vbox" style="display: none;">\
			<div id="git-buttons" class="hbox">\
				<div id="gitBranchBar">\
					<select id="gitBranch">\
					</select>\
				</div>\
				<div class="flex" id="gitViewContainer">\
					<span id="gitViewRadio">\
						<input type="radio" name="gitViewItem" value="Changes" id="changesRadio"><label for="changesRadio">Changes</label>\
						<input type="radio" name="gitViewItem" value="History" id="historyRadio" checked><label for="historyRadio">History</label>\
					</span>\
				</div>\
				<button id="gitNenuBtn"><i class="fa fa-bars"></i></button>\
				<ul id="gitMenu"></ul>\
			</div>\
			<div id="gitContentContainer" class="vbox">\
				<ul id="gitHistory"></ul>\
				<div id="changesContainer" class="vbox" style="display: none;">\
					<ul id="gitChanges" class="flex"></ul>\
					<div id="commitPanel">\
						<input id="gitSubject" type="text" name="subject" placeholder="Summary">\
						<textarea id="gitDescription" placeholder="Description"></textarea>\
						<button type="button" id="commitBtn" disabled>Commit to master</button>\
					</div>\
				</div>\
			</div>\
		</div>\
	</div>');
	
	$( "#gitViewRadio input[type='radio']" ).checkboxradio({
		icon: false
	});
	var gitCombo = $( "#gitBranch" ).combobox({
		select: function (event, ui) {
			// load branch
			checkout(ui.item.value);
		},
		change: function (event, ui) {
			// load branch
			checkout(ui.item.value);
		},
		create: function( event, ui ) {
		}
	});
	
	//button menu
	var items = [{
		id: 'gitsync',
		text: 'Sync',
		handler: sync
	}, {
		id: 'gitcreatebranch',
		text: 'Create branch',
		handler: createBranch
	}, {
		id: 'gitdeletebranch',
		text: 'Delete branch',
		handler: deleteBranch
	}];
		
	var el = $("#gitMenu");
	var context;
	items.forEach(function(item) {
		if(item==='-') {
			el.append('<li>-</li>');
		} else {
			var itemEl = $('<li id="'+item.id+'">\
				<a href="#">'+item.text+'</a>\
			</li>').appendTo(el);

			if(item.disabled) {
				itemEl.addClass('ui-state-disabled');
			}

			if(item.handler) {
				itemEl.click(jQuery.proxy(item.handler, undefined, context));
			}
		}
	});

	var menu = el.menu().hide();

	$("#gitNenuBtn").button()
	.click(function() {
		// Make use of the general purpose show and position operations
		// open and place the menu where we want.
		menu.show().position({
			  my: "left top",
			  at: "left bottom",
			  of: this
		});

		// Register a click outside the menu to close it
		$( document ).on( "click", function() {
			  menu.hide();
		});

		// Make sure to return false here or the click registration
		// above gets invoked.
		return false;
	});
	
	$('#tree').on('open_node.jstree', function(e, obj) {
		if (obj.node.id==='#root')
			refresh();
	});
	$('body').on('save','.ui-tabs', refresh);
	
	$("#gitHistory").basicMenu({
		select: function (event, ui) {
			var title = $(ui.item).find('.subject').text();
			if ($(ui.item).data('diff')) {
				show(title, $(ui.item).data('diff'));
			} else {
				var hash = $(ui.item).data('hash');
				var ajaxOptions = site.getAjaxOptions(config.apiBaseUrl+'files?site='+site.active());
				loading.fetch(ajaxOptions.url+'&cmd=show&commit='+hash, {
					action: 'show commit',
					success: function(data) {
						if (data.success) {
							$(ui.item).data('diff', data.result);
							show(title, $(ui.item).data('diff'));
						} else {
							prompt.alert({title:'Error', msg:data.error});
						}
					}
				});
			}
		}
	});
	
	$("#gitChanges").basicMenu({
		select: function (event, ui) {
			var title = $(ui.item).text();
			if ($(ui.item).data('diff')) {
				show(title, $(ui.item).data('diff'));
			} else {
				var path = $(ui.item).data('path');
				var ajaxOptions = site.getAjaxOptions(config.apiBaseUrl+'files?site='+site.active());
				loading.fetch(ajaxOptions.url+'&cmd=diff&path='+path, {
					action: 'diff '+path,
					success: function(data) {
						if (data.success) {
							$(ui.item).data('diff', data.result);
							show(title, $(ui.item).data('diff'));
						} else {
							prompt.alert({title:'Error', msg:data.error});
						}
					}
				});
			}
		}
	});
	
	$('#gitViewContainer input:radio').change(function() {
		if (this.value==='Changes') {
			$('#gitHistory').hide();
			$('#changesContainer').show();
		} else if (this.value==='History') {
			$('#gitHistory').show();
			$('#changesContainer').hide();
		}
	});
	
	var checkCommit = function() {
		if ($('#gitSubject').val() && $('#gitChanges input:checked').length) {
			$('#commitBtn').removeAttr('disabled');
		} else {
			$('#commitBtn').attr('disabled', 'disabled');
		}
	};
	
	$('#gitChanges').on('change click input', 'input', checkCommit);
	$('#gitSubject').on('change keyup input', checkCommit);
	
	$('#commitBtn').click(function() {
		var params = {};
		params.subject = $('#gitSubject').val();
		params.description = $('#gitDescription').val();
		
		// get checked files
		params.paths = [];
		$.each($('#gitChanges input:checked'), function( index, item ) {
			params.paths.push($(this).closest('li').data('path'));
		});
		
		// post it
		var ajaxOptions = site.getAjaxOptions(config.apiBaseUrl+'files?site='+site.active());
		loading.fetch(ajaxOptions.url+'&cmd=commit', {
			action: 'commit',
			data: params,
			success: function(data) {
				if (data.success) {
					tree.refresh();
				} else {
					prompt.alert({title:'Error', msg:data.error});
				}
			}
		});
	});
	
	$.contextMenu({
		selector: '#gitChanges li',
		callback: function(key, opt){
			switch(key) {
				case 'open':
					tabs.open($(this).data('path'), site.active());
				break;
				case 'discard':
					var ajaxOptions = site.getAjaxOptions(config.apiBaseUrl+'files?site='+site.active());
					loading.fetch(ajaxOptions.url+'&cmd=discard&path='+$(this).data('path'), {
						action: 'discard file',
						success: function(data) {
							if (data.success) {
								tree.refresh();
							} else {
								prompt.alert({title:'Error', msg:data.error});
							}
						}
					});
				break;
			}
		},
		items: {
			"open": {name: "Open file"},
			"discard": {name: "Discard changes"}
		}
	});
}

function show(title, result) {
	// check for tab or create it
	
	// add result to tab
	var tab = $('li[data-type=git]');
	var minWidth = 300;
	var myLayout = layout.get();
	
	if(tab.length) {
		tabpanel = tab.closest('.ui-tabs');
		tabpanel.tabs("option", "active", tab.index());

		//get nearest panel
		var pane = tab.closest('.ui-layout-pane');
		var paneName = pane[0].className.match('ui-layout-pane-([a-z]*)')[1];

		//expand panel
		myLayout.open(paneName);
		if (pane.outerWidth() < minWidth) {
			myLayout.sizePane(paneName, minWidth);
		}
	} else {
		tab = $(".ui-layout-center").tabs('add', 'Git', '<div id="gitDiff" class="git"></div>');
		tab.addClass('closable');
		tab.attr('data-type', 'git');
	}
	
	tab.children('.ui-tabs-anchor').attr('title', title);
	tab.children('.ui-tabs-anchor').contents().last().replaceWith(title);
	
	var diff2htmlUi = new Diff2HtmlUI({diff: result});

	diff2htmlUi.draw('#gitDiff', {
		inputFormat: 'json', //diff
		//showFiles: true,
		matching: 'lines'
	});
	//diff2htmlUi.highlightCode('#gitDiff');
}

function refresh() {
	// must have a git folder and use SFTP or a proxy
	var settings = site.getSettings(site.active());
	
	if (
		!$('#tree').jstree(true).get_node('.git') ||
		(
			['AJAX','SFTP','AWS','Linode'].indexOf(settings.server_type)===-1 &&
			!settings.turbo 
		)
	) {
		$('#gitContainer').hide();
		$('#notAvailable').html('Git panel will appear here').show();
		return;
	}
	
	// get commits / branches / status
	gitLog();
}

function gitLog() {
	var ajaxOptions = site.getAjaxOptions(config.apiBaseUrl+'files?site='+site.active());
	
	loading.fetch(ajaxOptions.url+'&cmd=git_info', {
		giveWay: true,
		action: false,
		success: function(data) {
			// branches
			$( "#gitBranch" ).children('option').remove();

			$.each(data.branches, function( index, branch ) {
				$( "#gitBranch" ).append( '<option value="'+branch.name+'">' + branch.name + '</option>' );
				if (branch.selected) {
					$( "#gitBranch" ).combobox('val', branch.name);
					$( '#commitBtn' ).text('Commit to '+branch.name);
					
					if (branch.name==='master') {
						$('#gitdeletebranch').addClass('ui-state-disabled');
					} else {
						$('#gitdeletebranch').removeClass('ui-state-disabled');
					}
				}
			});
			
			// history
			$( "#gitHistory" ).children().remove();
			$.each(data.commits, function( index, item ) {
				$( '<li><a href="#"><span class="subject">' + item.subject + '</span><br><span class="date">' + item.date + '</span> by <span class="author">' + item.author + '</span></a></li>' ).appendTo( "#gitHistory" )
				.attr('data-hash', item.hash);
			});
			
			// changes
			$("#gitChanges li").addClass('delete').removeData('diff');
			$.each(data.changes, function( index, item ) {
				var li = $("#gitChanges").find('[data-path="'+item.path+'"]');
				if ( li.length ) {
					li.removeClass('delete');
				} else {
					$( '<li><a href="#"><input type="checkbox" value="1" checked>' + item.path + '</a></li>' ).appendTo( "#gitChanges" )
					.attr('data-path', item.path);
				}
			});
			$( "#gitChanges" ).children('.delete').remove();
			
			$('#notAvailable').hide();
			$('#gitContainer').show();
		},
		error: function(error) {
			$('#gitContainer').hide();
			$('#notAvailable').html(error).show();
		}
	});
}

function checkout(branch) {
	var ajaxOptions = site.getAjaxOptions(config.apiBaseUrl+'files?site='+site.active());
	
	loading.fetch(ajaxOptions.url+'&cmd=checkout&branch='+branch, {
		action: 'git checkout '+branch,
		success: function(data) {
			if (data.success) {
				tree.refresh();
			} else {
				prompt.alert({title:'Error', msg:data.error});
			}
		}
	});
}

function createBranch() {
	$( "body" ).append('<div id="dialog-branch" title="Branch">\
	  <form id="branchForm" class="tidy">\
		<p class="hbox">\
			<label>Name:</label>\
			<input type="text" name="name" class="flex">\
		</p>\
		<p class="hbox">\
			<label>From branch:</label>\
			<select name="from" class="flex"></select>\
		</p>\
	  </form>\
	</div>');
	
	var dialog = $( "#dialog-branch" ).dialog({
		modal: true,
		width: 300,
		height: 180,
		close: function( event, ui ) {
			$( this ).remove();
		},
		buttons: {
			create: {
				text: "Create new branch",
				id: "createBranchBtn",
				click: function() {
					var ajaxOptions = site.getAjaxOptions(config.apiBaseUrl+'files?site='+site.active());
					var name = $('#branchForm input[name=name]').val();
					var from = $('#branchForm select[name=from]').val();
					
					loading.fetch(ajaxOptions.url+'&cmd=create_branch&name='+name+'&from='+from, {
						action: 'git checkout -b '+name+' '+from,
						success: function(data) {
							if (data.success) {
								$( '#branchForm' ).dialog( "close" );
								tree.refresh();
							} else {
								prompt.alert({title:'Error', msg:data.error});
							}
						}
					});
				},
				disabled: true
			},
		}
	});
	
	// branch options
	$.each($('#gitBranch option'), function( index ) {
		var option = $( "#branchForm select[name=from]" ).append( '<option value="'+this.value+'">' + this.value + '</option>' );
	});
	
	$( "#branchForm input[name=from]" ).val($('#gitBranch').val());
	
	$('#branchForm input[name=name]').on('change input keyup', function() {
		// replace non-alphanumeric characters
		var name = $(this).val();
		var newName = name.replace(/\W/g, "-");
		if (name!=newName) {
			$(this).val(newName);
		}
		
		if ($(this).val()) {
			$('#createBranchBtn').button( "option", "disabled", false );
		} else {
			$('#createBranchBtn').button( "option", "disabled", true );
		}
	});
}

function deleteBranch() {
	var branch = $( "#gitBranch" ).combobox('val');
	
	prompt.confirm({
		title: 'Delete branch '+branch,
		msg: 'Are you sure?',
		fn: function(value) {
			if (value==='yes') {
				var ajaxOptions = site.getAjaxOptions(config.apiBaseUrl+'files?site='+site.active());
				loading.fetch(ajaxOptions.url+'&cmd=delete_branch&branch='+branch, {
					action: 'git branch -d '+branch,
					success: function(data) {
						if (data.success) {
							tree.refresh();
						} else {
							prompt.alert({title:'Error', msg:data.error});
						}
					}
				});
			
				return;
			}
			
			return false;
		}
	});
}

function sync() {
	var ajaxOptions = site.getAjaxOptions(config.apiBaseUrl+'files?site='+site.active());
	loading.fetch(ajaxOptions.url+'&cmd=sync', {
		action: 'syncing',
		success: function(data) {
			if (data.success) {
				tree.refresh();
			} else {
				prompt.alert({title:'Error', msg:data.error});
			}
		}
	});
}

return {
	init: init
};
});