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
    console.log(toggler_location);

    var box = document.createElement('ul');
    box.className = 'c-navigation__group c-navigation__group--pinned';
    box.innerHTML = "<li class='c-navigation__item'><label class='c-navigation__item__inner  c-navigation__item__action'><input id='showcheckbox' type='checkbox'>&nbsp;Show at-target</label></li>";
    toggler_location.append(box);

    $('#showcheckbox').on("click", function() {
        //show_at_target_by_default
        GM_setValue('show_at_target_by_default', this.checked);
        toggle_attarget(this.checked, target_xpath);
    });

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
