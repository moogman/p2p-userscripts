// ==UserScript==
// @name         moneything-filter
// @namespace    https://github.com/moogman/p2p-userscripts/scripts/moneything
// @version      0.1.7
// @description  Filter out various things on the MoneyThing website.
// @author       moogman
// @homepage     http://p2pindependentforum.com/thread/9306/moneything-browser-extension
// @match        https://www.moneything.com/p2p/index.php/loan
// @match        https://www.moneything.com/p2p/index.php/Loan
// @match        https://www.moneything.com/p2p/index.php/Loan.html
// @match        https://www.moneything.com/p2p/index.php/Center/invest/mid/live.html
// @match        https://www.moneything.com/p2p/index.php/Loan/invest/*
// @match        https://www.moneything.com/p2p/index.php/Center.html
// @match        https://www.moneything.com/p2p/index.php/Auth/login.html
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_addStyle
// @grant        GM_getResourceText
// @run-at       document-start
// @require      ../../includes/p2p-common.user.js
// @require      https://ajax.googleapis.com/ajax/libs/jquery/3.1.1/jquery.min.js
// @require      https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js
// @resource     jquery_css https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/themes/ui-lightness/jquery-ui.min.css
// ==/UserScript==

/* ### DO NOT EDIT ANYTHING HERE - IT WILL BE OVERWRITTEN ON UPDATE ###
Please log a feature request through the forum.
*/


set_defaults(false);
var target_upper_spread = 1.1;  //  Investment target + this value is the upper target, whereby any investments >= this level will be highlighted in red.

/* Start of user-editable variables */
/* End of user-editable variables */


// Row IDs (ids 0-x).
var [description_row,
     loanvalue_row,
     assetvalue_row,
     ltv_row,
     rate_row,
     biddingstart_row,
     remaining_row, //enddate_row,
     available_row,
     invested_row,
     drawdown_row,
     renew_row
     ] = Array.from(new Array(20), (x,i) => i);

// Xpath locations.
var each_tr = "//*[@id='table1']/*/tr[*]";  // Match on each <tr> of the available loan table.
var options_location = '//*[@id="content"]/div[2]';


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
    setup_target_toggler_checkbox(options_location, each_tr);

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

        var amnt_available = 1;
        if (tr.children[available_row].textContent == '0.00%') {
            amnt_available = -1;
        }

        filter.by_invested(tr, amnt_available, target_upper_spread);  // Hide any at target investment level.
        filter.by_interest_rate(tr);                                  // Hide any loans with IR < 12%.
        filter.by_regexp(tr);                                         // Hide any filtered rows (e.g. "IMMINENT REPAYMENT" or "EXPECTED REPAYMENT").
        filter.by_remaining(tr, false);                               // Hide any with few days remaining.


        //
        // Platform-specific filters/hides.
        //

        // Hide some columns: Bidding start, Draw Down, Renew.
        tr.children[biddingstart_row].style.display = 'none';
        tr.children[drawdown_row].style.display = 'none';
        if (GM_getValue('show_loanvalue_column') === false) tr.children[loanvalue_row].style.display = 'none';
        if (GM_getValue('show_assetvalue_column') === false) tr.children[assetvalue_row].style.display = 'none';
        if (GM_getValue('show_renew_column') === false) tr.children[renew_row].style.display = 'none';


    });

}


function decorate_loan_page() {
    // Make the invest pane also active, and shuffle the panes so that it's at the top of the page.
    var details_pane = _x('//*[@id="details"]')[0];
    var invest_pane = _x('//*[@id="invest-now"]')[0];
    $(invest_pane).addClass('active');
    invest_pane.parentElement.insertBefore(invest_pane, details_pane);

    // Calculate investment suggestion.
    var existing_investment_xpath = '//*[@id="invest-now"]/div/div/form/dl/dd[1]/div';
    var my_funds_xpath = '//*[@id="invest-now"]/div/div/form/dl/dd[2]/span[@class="invest_price"]';
    var available_xpath = '//*[@id="invest-now"]/div/div/form/dl/dd[1]/span[2]';
    $("#price")[0].value = suggest_investment(existing_investment_xpath, my_funds_xpath, available_xpath);

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

    if (window.location.href.search('[lL]oan\(\|.html\)$') > -1) {  // Loans available page
        decorate_available_page();

    } else if (window.location.href.search('Center/invest/mid/live.html') > -1) { // My Loans page
        //decorate_my_loans_page();

    } else if (window.location.href.match('Loan/invest/[0-9]+.html') !== null) {  // A loan page
        decorate_loan_page();

    } else if (window.location.href.match('/Center.html') !== null) {  // Funds overview page
        decorate_funds_overview_page();

    } else if (window.location.href.match('/Auth/login.html') !== null) {  // Funds overview page
        // Focus the email box, so that you can press enter to login.
        $(_x('/html/body/div[1]/div[2]/div/div/form/div/div[1]/div/input')).focus();

    }

})();
