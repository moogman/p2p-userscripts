// ==UserScript==
// @name         moneything-filter
// @namespace    https://github.com/moogman/p2p-userscripts/scripts/moneything
// @version      0.1
// @description  Filter out various things on the MoneyThing website.
// @author       moogman
// @match        https://www.moneything.com/p2p/index.php/loan
// @match        https://www.moneything.com/p2p/index.php/Loan
// @match        https://www.moneything.com/p2p/index.php/Loan.html
// @match        https://www.moneything.com/p2p/index.php/Center/invest/mid/live.html
// @match        https://www.moneything.com/p2p/index.php/Loan/invest/*
// @grant        GM_setValue
// @grant        GM_getValue
// @require      file:///p2p-userscripts/includes/p2p-common.user.js
// @require      ../../includes/p2p-common.user.js
// @require      https://ajax.googleapis.com/ajax/libs/jquery/1.8.2/jquery.min.js
// ==/UserScript==

/* Start of user-editable variables */
var target_lower = 200;                   // Buy (green) if we have less than this amount in it.
var target_upper = 220;                   // Sell (red) if we have more than this amount in it.
var loan_rate_min = 12;                   // Hide loan if less than this interest rate.
/* End of user-editable variables */

var initial_wait_timer = 0.5;  // Wait this amount of seconds before decorating the loan table (Because the loan table is loaded after page load, via ajax).

// Row IDs.
var description_row = 0;
var rate_row = 4;
var biddingstart_row = 5;
var enddate_row = 6;
var available_row = 7;
var invested_row = 8;
var drawdown_row = 9;
var renew_row = 10;


function main() {
    // Hide out some loans that don't meet our requirements.
    var each_tr = "//*[@id='table1']/*/tr[*]";
    $(_x(each_tr)).each(function () {
        var tr = this;

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
        if (parseInt(this.children[rate_row].textContent) < loan_rate_min) {
            this.children[rate_row].style["background-color"] = '#ffdddd';
            tr.dataset.target = 'hit';
        }

        // Hide any "IMMINENT REPAYMENT" or "EXPECTED REPAYMENT".
        if (this.children[description_row].textContent.includes("IMMINENT REPAYMENT") || this.children[description_row].textContent.includes("EXPECTED REPAYMENT")) {
            this.children[description_row].style["background-color"] = '#ffdddd';
            tr.dataset.target = 'hit';
        }

        // Hide all 'renew' and 'Draw Down' columns.
        this.children[biddingstart_row].style.display = 'none';
        this.children[drawdown_row].style.display = 'none';
        this.children[renew_row].style.display = 'none';

    });

    setup_target_toggler_checkbox('//*[@id="content"]/div[2]', each_tr);
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
        console.log(existing_investment_div[0]);
        var investment_txt = existing_investment_div[0].innerText;
        if (investment_txt.startsWith("My existing investment: £")) {
            existing_investment = str_to_pounds(investment_txt.replace("My existing investment: ", ""));
        }
    }

    // Calculate investment suggestions.
    var suggestions = {
        '50': 50-existing_investment,
        '100': 100-existing_investment,
        '150': 150-existing_investment,
        '200': 200-existing_investment,
    };
    var suggestion_txt = '';
    for (var key in suggestions) {
        var val = suggestions[key];
        if (val < 0) val=0;
        suggestion_txt += '£' + key + '->£' + val + '. ';
    }

    // Add box with suggestions.
    var my_funds = $(_x('//*[@id="invest-now"]/div/div/form/dl/dd[2]'));
    my_funds.append('&nbsp;&nbsp;|&nbsp;&nbsp;<span class="invest-price">Suggested: ' + suggestion_txt + '</span>');

    // Focus the price box.
    $('#price').focus();
}

(function() {
    'use strict';

    if (window.location.href.search('[lL]oan\(\|.html\)$') > -1) {
        /* Loans available page */
        console.log('loans/available page');
        var reloader_timeout = setTimeout(main, initial_wait_timer*1000);

    } else if (window.location.href.search('Center/invest/mid/live.html') > -1) {
        /* My Loans page */
        console.log('my loans page');

    } else if (window.location.href.match('Loan/invest/[0-9]+.html') !== null) {
        /* A loan page */
        console.log('a loan page');
        decorate_loan_page();
    }

})();
