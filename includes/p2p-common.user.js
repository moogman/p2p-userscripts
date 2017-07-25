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
        <tr><td>Filter out regexp<br /> (Separate with "|"):</td><td><textarea id='loan_hide_regexp' style='height: 100px; width: 500px;' /></td></tr>
        </table>
        <h4>Display options:</h4>
        <label><input id='show_loanvalue_column' type='checkbox' />Show 'Loan value' column</label>
        <label><input id='show_assetvalue_column' type='checkbox' />Show 'Asset value' column</label>
        <label><input id='show_renew_column' type='checkbox' />Show 'Renew' column</label>
        </div>
    `);
    $("#options_dialog").dialog({
        title: 'moogFilter Options',
        autoOpen: false,
        closeText: '',
        width: 'auto',
        buttons: {
            'Restore Defaults' : function() {
                if (confirm('Are you sure you want to restore all settings to default?') === true) {
                    set_defaults(true);
                    $(this).dialog('close');
                }
            },
            'Close' : function() {
                $(this).dialog('close');
            }
        },
        close: function(event, ui) {
            // Refresh page on hide, to update table.
            location.reload();
        }
    });

    // Setup default values.
    $('#showcheckbox').prop('checked', GM_getValue('show_at_target_by_default'));
    $('#investment_target')[0].value = parseFloat(GM_getValue('investment_target'));
    $('#min_interest_rate')[0].value = parseFloat(GM_getValue('min_interest_rate'));
    $('#loan_hide_regexp')[0].value = GM_getValue('loan_hide_regexp');
    $('#show_loanvalue_column').prop('checked', GM_getValue('show_loanvalue_column'));
    $('#show_assetvalue_column').prop('checked', GM_getValue('show_assetvalue_column'));
    $('#show_renew_column').prop('checked', GM_getValue('show_renew_column'));


    // Setup JS for each new control.
    $('#showcheckbox').on("click", function() {
        GM_setValue('show_at_target_by_default', this.checked);
        toggle_attarget(this.checked, target_xpath);
    });
    $('#investment_target').on("keyup", function() {
        GM_setValue('investment_target', parseInt(this.value));
    });
    $('#min_interest_rate').on("keyup", function() {
        GM_setValue('min_interest_rate', parseFloat(this.value));
    });
    $('#loan_hide_regexp').on("keyup", function() {
        $(this).val($(this).val().replace(/[\r\n\v]+/g, ''));
        GM_setValue('loan_hide_regexp', this.value);
    });
    $('#show_loanvalue_column').on("click", function() {
        GM_setValue('show_loanvalue_column', this.checked);
    });
    $('#show_assetvalue_column').on("click", function() {
        GM_setValue('show_assetvalue_column', this.checked);
    });
    $('#show_renew_column').on("click", function() {
        GM_setValue('show_renew_column', this.checked);
    });

    $('#open_options').on("click", function() {
        $('#options_dialog').dialog('open');
    });

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


function set_defaults(re_initialise) {
    var cookies = {
        'investment_target': 200,
        'min_interest_rate': 10,
        'show_at_target_by_default': false,
        'loan_hide_regexp': 'IMMINENT REPAYMENT|EXPECTED REPAYMENT',
        'show_loanvalue_column': true,
        'show_assetvalue_column': true,
        'show_renew_column': false,
    };

    /* Delete saved cookies if initialise set. */
    if (re_initialise) {
        for (var key in cookies) {
            GM_deleteValue(key);
        }
    }

    /* Save default values if none exist. */
    for (var key in cookies) {
        var val = cookies[key];
        if (GM_getValue(key) === undefined) {
            GM_setValue(key, val);
        }
    }

}


var filter = {
    by_invested: function(tr, amnt_available, target_upper_spread) {
        // Hide any at target investment level.
        var invested_td = tr.children[invested_row];
        var invested = str_to_pounds(invested_td.textContent) || 0;
        var target_lower = parseFloat(GM_getValue('investment_target'));
        var target_upper = target_lower * target_upper_spread;
        if (amnt_available < 1) {
            // none available -> mark as hit (hide).
            tr.dataset.target = 'hit';
        } else if (invested > target_upper) {
            // heavy -> make red
            invested_td.style["background-color"] = '#ffdddd';
            tr.dataset.target = 'above';
        } else if (invested > target_lower) {
            // light -> make orange
            invested_td.style["background-color"] = '#fff6db';
            tr.dataset.target = 'hit';
        } else if (invested < target_lower) {
            // light -> make green
            invested_td.style["background-color"] = '#ddffdd';
            tr.dataset.target = 'below';
        } else {
            tr.dataset.target = 'hit';
        }
    },
    by_interest_rate: function(tr) {
        // Hide any loans with IR < 12%.
        var interest_rate = parseFloat(tr.children[rate_row].textContent);
        if (interest_rate < parseFloat(GM_getValue('min_interest_rate'))) {
            tr.children[rate_row].style["background-color"] = '#ffdddd';
            tr.dataset.target = 'hit';
        }
    },
    by_regexp: function(tr) {
        // Hide any filtered rows (e.g. "IMMINENT REPAYMENT" or "EXPECTED REPAYMENT").
        var hide_re = RegExp(GM_getValue('loan_hide_regexp'));
        if (tr.children[description_row].textContent.match(hide_re)) {
            tr.children[description_row].style["background-color"] = '#ffdddd';
            tr.dataset.target = 'hit';
        }
    }
};

/*
var Filter = function() {
}
Filter.prototype = {
    constructor: Filter,

    by_interest_rate: function(tr) {
    }
}
var filter = new Filter();
*/
