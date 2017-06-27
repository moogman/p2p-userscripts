function str_to_pounds(string) {
    // Filter out [£,] in e.g. "£1,234"
    return parseFloat(string.replace(/[£,]/g , ""));
}


function _x(STR_XPATH, parent=document) {
    // Return element by xpath.
    var xresult = document.evaluate(STR_XPATH, parent, null, XPathResult.ANY_TYPE, null);
    var xnodes = [];
    var xres;

    while (xres = xresult.iterateNext()) {
        xnodes.push(xres);
    }

    return xnodes;
}


/* Loan toggler functionality. */
function setup_target_toggler_checkbox(toggler_location_xpath, target_xpath) {
    // Add a JS checkbox to show/hide loans that can't be invested.
    var toggler_location = $(_x(toggler_location_xpath));
    toggler_location.children()[0].style.display = 'inline-block';

    // Add jQueryUI style sheet.
    // Disable as MT already uses jQueryUI.
    //$("head").append ('<link https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/themes/ui-lightness/jquery-ui.min.css" rel="stylesheet" type="text/css">');

    // Add HTML blob with checkbox/buttons in it.
    var box = document.createElement('ul');
    box.className = 'c-navigation__group c-navigation__group--pinned';
    box.style.display = 'inline-block';
    box.innerHTML = `
        <li class='c-navigation__item'>
        <label class='c-navigation__item__inner  c-navigation__item__action' style='display: inline-block;'>
            &nbsp;<input id='showcheckbox' type='checkbox' />&nbsp;Show at-target
        </label>
        <button id='open_options' type='button' class='btn btn-primary'>Options</button>
        </li>
`;
    toggler_location.append(box);

    // Create options dialogue.
    $("body").append (`
        <div id="options_dialog">
        <h4>Filter options:</h4>
        <table>
        <tr><td>Investment target:</td><td>£<input id='investment_target' type='text' style='width: 60px;' /></td></tr>
        <tr><td>Min interest rate:</td><td><input id='min_interest_rate' type='text' style='width: 45px;' />%</td></tr>
        </table>
        </div>
    `);
    $("#options_dialog").dialog({
        title: 'moogFilter Options',
        autoOpen: false,
        closeText: '',
        width: 'auto',
        buttons: {
            'Hide' : function() {
                $(this).dialog('close');
            }
        },
        close: function(event, ui) {
            // Refresh page on hide, to update table.
            location.reload();
        }
    });

    // Setup default values.
    $('#investment_target')[0].value = parseFloat(GM_getValue('investment_target', 200));
    $('#min_interest_rate')[0].value = parseFloat(GM_getValue('min_interest_rate', 10.0));

    // Setup JS for each new control.
    $('#showcheckbox').on("click", function() {
        //show_at_target_by_default
        GM_setValue('show_at_target_by_default', this.checked);
        toggle_attarget(this.checked, target_xpath);
    });
    $('#investment_target').on("keyup", function() {
        GM_setValue('investment_target', parseInt(this.value));
    });
    $('#min_interest_rate').on("keyup", function() {
        GM_setValue('min_interest_rate', parseFloat(this.value));
    });
    $('#open_options').on("click", function() {
        $('#options_dialog').dialog('open');
    });

    // Trigger table filtering.
    var show_at_target_by_default = GM_getValue('show_at_target_by_default', false);     // Show 'loans already at target' on initial load.
    toggle_attarget(show_at_target_by_default, target_xpath);
    $('#showcheckbox').prop('checked', show_at_target_by_default);
}


function toggle_attarget(show, target_xpath) {
    // show
    $(_x(target_xpath)).each(function() {
        if (this.dataset.target === "hit" || this.dataset.target === "above" ) {
            // Unavailable loan tr
            if (show) {
                this.style.display = '';
            } else {
                this.style.display = 'none';
            }
        }
    });
}
