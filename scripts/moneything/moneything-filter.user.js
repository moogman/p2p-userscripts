// ==UserScript==
// @name         moneything-filter
// @namespace    https://github.com/moogman/p2p-userscripts/scripts/moneything
// @version      0.1.7
// @description  Filter out various things on the MoneyThing website.
// @author       moogman
// @match        https://www.moneything.com/p2p/index.php/loan
// @match        https://www.moneything.com/p2p/index.php/Loan
// @match        https://www.moneything.com/p2p/index.php/Loan.html
// @match        https://www.moneything.com/p2p/index.php/Center/invest/mid/live.html
// @match        https://www.moneything.com/p2p/index.php/Loan/invest/*
// @match        https://www.moneything.com/p2p/index.php/Center.html
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_addStyle
// @require      ../../includes/p2p-common.user.js
// @require      https://ajax.googleapis.com/ajax/libs/jquery/3.1.1/jquery.min.js
// @require      https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js
// ==/UserScript==

/* ### DO NOT EDIT ANYTHING HERE - IT WILL BE OVERWRITTEN ON UPDATE ###
Please log a feature request through the forum.
*/


set_defaults(false);
var target_upper_spread = 1.1;  //  Investment target + this value is the upper target, whereby any investments >= this level will be highlighted in red.
var initial_wait_timer = 0.5;  // Wait this amount of seconds before decorating the loan table (Because the loan table is loaded after page load, via ajax).

// Row IDs.
var description_row = 0;
var loanvalue_row = 1;
var assetvalue_row = 2;
var ltv_row = 3;
var rate_row = 4;
var biddingstart_row = 5;
var enddate_row = 6;
var available_row = 7;
var invested_row = 8;
var drawdown_row = 9;
var renew_row = 10;

// Xpath locations.
var each_tr = "//*[@id='table1']/*/tr[*]";  // Match on each <tr> of the available loan table.


function decorate_available_page() {
    // Expand the main table.
    $(_x("/html/body/div[1]/div[2]/div")).removeClass("container").addClass("container-fluid");
    // Reduce the padding on the table headings, to compress things more.
    // .fixed-table-container thead th .sortable  -> padding-right: 15px;
    // .fixed-table-container tbody td .th-inner, .fixed-table-container thead th .th-inner  -> padding: 2px;
    GM_addStyle(`
    .fixed-table-container tbody td .th-inner, .fixed-table-container thead th .th-inner {
        /* Make that able heading padding smaller */
        padding: 0px;
    }
    .fixed-table-container thead th .sortable {
        /* Make the table heading right padding smaller */
        padding-right: 10px;
    }
    .th-inner {
        /* Make the table heading text smaller */
        font-size: 10px;
    }
    .fixed-table-container thead th .sortable {
        /* Shift the sortable icon to the right a bit. */
        background-position: 115%;
    }
    `);

    // Install the button bar for toggling and options.
    setup_target_toggler_checkbox('//*[@id="content"]/div[2]', each_tr);

    // Listen to changes on the loan table (for example, at first load, and at table column refresh times).
    var target = _x('//*[@id="table1"]')[0];

    // create an observer instance
    var observer_config = { childList: true, attributes: false, characterData: false, subtree: true};
    var observer = new MutationObserver(function(mutations) {
        decorate_available_table();
        /* Trigger a table refresh.  */
        toggle_attarget(GM_getValue('show_at_target_by_default'), each_tr);
    });
    observer.observe(target, observer_config);

}


function decorate_available_table() {
    // Hide out some loans that don't meet our requirements.
    $(_x(each_tr)).each(function () {
        var tr = this;

        if (tr.children.length < 8) {
            // If we don't have enough cells, the table isn't loaded yet - Exit.
            return false;
        }

        for (var child of tr.children) {
            child.style.padding = '2px';
        }

        var is_available_page = true;
        var invested_td = this.children[invested_row];
        var invested = str_to_pounds(invested_td.textContent) || 0;
        var available = -1;
        if (is_available_page) {
            var available_td = tr.children[available_row];
            //available = str_to_pounds(available_td.textContent);
             if (available_td.textContent != '0.00%') {
                 available = 1;
             }
        }

        // Hide any at target investment level.
        var target_lower = parseFloat(GM_getValue('investment_target'));
        var target_upper = target_lower * target_upper_spread;
        if (is_available_page && available < 1) {
            tr.dataset.target = 'hit';
            //tr.style.display = 'none';
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

        // Hide any loans with IR < 12%.
        if (parseFloat(this.children[rate_row].textContent) < parseFloat(GM_getValue('min_interest_rate'))) {
            this.children[rate_row].style["background-color"] = '#ffdddd';
            tr.dataset.target = 'hit';
        }

        // Hide any "IMMINENT REPAYMENT" or "EXPECTED REPAYMENT".
        var hide_re = RegExp(GM_getValue('loan_hide_regexp'));
        if (this.children[description_row].textContent.match(hide_re)) {
            this.children[description_row].style["background-color"] = '#ffdddd';
            tr.dataset.target = 'hit';
        }

        // Hide some columns: Bidding start, Draw Down, Renew.
        this.children[biddingstart_row].style.display = 'none';
        this.children[drawdown_row].style.display = 'none';
        if (GM_getValue('show_loanvalue_column') === false) this.children[loanvalue_row].style.display = 'none';
        if (GM_getValue('show_assetvalue_column') === false) this.children[assetvalue_row].style.display = 'none';
        if (GM_getValue('show_renew_column') === false) this.children[renew_row].style.display = 'none';

    });

}


function decorate_loan_page() {
    var details_pane = _x('//*[@id="details"]')[0];
    var invest_pane = _x('//*[@id="invest-now"]')[0];

    // Make the invest pane also active, and shuffle the panes so that it's at the top of the page.
    $(invest_pane).addClass('active');
    invest_pane.parentElement.insertBefore(invest_pane, details_pane);

    // Calculate existing investment.
    var existing_investment = 0;
    var existing_investment_div = _x('//*[@id="invest-now"]/div/div/form/dl/dd[1]/div');
    if (existing_investment_div.length > 0) {
        var investment_txt = existing_investment_div[0].innerText;
        if (investment_txt.startsWith("My existing investment: £")) {
            existing_investment = str_to_pounds(investment_txt.replace("My existing investment: ", ""));
        }
    }

    // Populate investment suggestion.
    var my_funds_div = _x('//*[@id="invest-now"]/div/div/form/dl/dd[2]/span[@class="invest_price"]')[0];
    var my_funds = str_to_pounds(my_funds_div.innerText);

    // Calculate investment suggestion.
    var target_lower = parseFloat(GM_getValue('investment_target'));
    var suggested_investment = Math.max(0, target_lower - existing_investment);
    suggested_investment = Math.min(Math.floor(my_funds), suggested_investment);

    var invest_box = _x('//*[@id="price"]')[0];
    invest_box.value = suggested_investment;

    // Focus the price box.
    $("#price").focus(function() { $(this).select(); } );  // On focus, select all the text.
    $('#price').focus();
}


function decorate_funds_overview_page() {
    // Add "Total on platform" section.
    var balance_elem = $(_x('//*[@id="content"]/div/div/p')[0]);

    var live_elem = $(_x('/html/body/div[1]/div[2]/div[2]/div[1]/div/div[2]/table/tbody/tr[1]/td[3]'))[0];
    var account_balance_elem = $(_x('//*[@id="content"]/div/div/p/span[1]'))[0];

    var total = str_to_pounds(live_elem.innerText) + str_to_pounds(account_balance_elem.innerText);
    balance_elem.append(' &nbsp; &nbsp;Total funds: <span class="blue">£' + total + '</span>');
    console.log(balance_elem.innerHTML);
}


(function() {
    'use strict';

    if (window.location.href.search('[lL]oan\(\|.html\)$') > -1) {
        /* Loans available page */
        console.log('loans/available page');
        decorate_available_page();

    } else if (window.location.href.search('Center/invest/mid/live.html') > -1) {
        /* My Loans page */
        console.log('my loans page');

    } else if (window.location.href.match('Loan/invest/[0-9]+.html') !== null) {
        /* A loan page */
        console.log('a loan page');
        decorate_loan_page();

    } else if (window.location.href.match('/Center.html') !== null) {
        /* Funds overview page */
        console.log('funds overview page');
        decorate_funds_overview_page();
    }

})();
