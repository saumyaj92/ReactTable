/**
 * - STOP -
 *
 * please do not add too many states to the table. Per react.js documentation for best practices, any value derivable from props alone should NOT be stored as a state
 * but instead should be computed each time as the render() function.
 *
 * states are used to store info that cannot be inferred or derived from 'props', such as user interaction that occur within the component (collapsing a subtotal grouping / adding a column to sort)
 *
 */
function ReactTableGetInitialState() {

    var initialState = {
        uniqueId: uniqueId("table"), // i guess since this is randomly generated, it is not derivable from props alone
        currentPage: 1, // self-explanatory
        lastScrollTop: 0, // self-explanatory, this is the spiritual of currentPage for paginators

        // we shall consider any props that is modifiable through user interaction a state
        columnDefs: this.props.columnDefs,
        subtotalBy: this.props.subtotalBy,
        sortBy: this.props.sortBy,

        lowerVisualBound: 0,
        upperVisualBound: this.props.pageSize,
        extraStyle: {}, // TODO document use
        filterInPlace: {}, // TODO document use, but sounds like a legit state
        currentFilters: [] // TODO same as above
    };

    /**
     * justifiable as a state because its children contain sub-states like collapse/expanded or hide/un-hide
     * these states/sub-states arise from user interaction with this component, and not derivable from props or other states
     */
    initialState.rootNode = createNewRootNode(this.props, initialState);
    if (initialState.sortBy.length > 0)
        initialState.rootNode.sortNodes(convertSortByToFuncs(initialState.columnDefs, initialState.sortBy));

    var selections = getInitialSelections(this.props.selectedRows, this.props.selectedSummaryRows);
    initialState.selectedDetailRows = selections.selectedDetailRows;
    initialState.selectedSummaryRows = selections.selectedSummaryRows;

    return initialState;
}

function ReactTableHandleSelect(selectedRow) {
    var rowKey = this.props.rowKey;
    if (rowKey == null)
        return;
    if (selectedRow.isDetail != null & selectedRow.isDetail == true)
        this.props.onSelectCallback(selectedRow, this.toggleSelectDetailRow(selectedRow[rowKey]));
    else if (this.props.onSummarySelectCallback)
        this.props.onSummarySelectCallback(selectedRow, this.toggleSelectSummaryRow(generateSectorKey(selectedRow.sectorPath)));

}

function ReactTableHandleUnselectAll(){
    this.props.onUnselectAllCallback(this.clearAllRowSelections());
}

function ReactTableHandleColumnFilter(columnDefToFilterBy, e, dontSet) {
    if (typeof dontSet !== "boolean")
        dontSet = undefined;

    var filterData = e.target ? (e.target.value || e.target.textContent) : e;
    var caseSensitive = !(this.props.filtering && this.props.filtering.caseSensitive === false);

    if (!dontSet) {
        // Find if this column has already been filtered.  If it is, we need to remove it before filtering again
        for (var i = 0; i < this.state.currentFilters.length; i++) {
            if (this.state.currentFilters[i].colDef === columnDefToFilterBy) {
                this.state.currentFilters.splice(i, 1);
                this.handleClearFilter(columnDefToFilterBy, true);
                break;
            }
        }
    }

    var customFilterer;
    if (this.props.filtering && this.props.filtering.customFilterer) {
        customFilterer = this.props.filtering.customFilterer;
    }
    this.state.rootNode.filterByColumn(columnDefToFilterBy, filterData, caseSensitive, customFilterer);

    if (!dontSet) {
        this.state.currentFilters.push({colDef: columnDefToFilterBy, filterText: filterData});
        $("input.rt-" + columnDefToFilterBy.colTag + "-filter-input").val(filterData);
        this.setState({rootNode: this.state.rootNode, currentFilters: this.state.currentFilters});
    }
}

function ReactTableHandleRemoveFilter(colDef, dontSet) {
    if (typeof dontSet !== "boolean")
        dontSet = undefined;

    // First clear out all filters
    for (var i = 0; i < this.state.rootNode.ultimateChildren.length; i++) {
        this.state.rootNode.ultimateChildren[i].hiddenByFilter = false;
    }
    // Remove filter from list of current filters
    for (i = 0; i < this.state.currentFilters.length; i++) {
        if (this.state.currentFilters[i].colDef === colDef) {
            this.state.currentFilters.splice(i, 1);
            break;
        }
    }
    // Re-filter by looping through old filters
    for (i = 0; i < this.state.currentFilters.length; i++) {
        this.handleColumnFilter(this.state.currentFilters[i].colDef, this.state.currentFilters[i].filterText, true);
    }

    if (!dontSet) {
        var fip = this.state.filterInPlace;
        delete fip[colDef.colTag];
        this.setState({
            filterInPlace: fip,
            rootNode: this.state.rootNode,
            currentFilters: this.state.currentFilters
        });
        $("input.rt-" + colDef.colTag + "-filter-input").val("");
    }
}

function ReactTableHandleRemoveAllFilters() {
    recursivelyClearFilters(this.state.rootNode);
    this.setState({
        filterInPlace: {},
        rootNode: this.state.rootNode,
        currentFilters: []
    });
    $("input.rt-filter-input").val("");
}

function recursivelyClearFilters(node) {
    node.clearFilter();

    for (var i = 0; i < node.children.length; i++) {
        recursivelyClearFilters(node.children[i]);
    }

    if (!node.hasChild()) {
        for (var i = 0; i < node.ultimateChildren.length; i++) {
            node.ultimateChildren[i].hiddenByFilter = false;
        }
    }
}

function applyAllFilters() {
    for (var i = 0; i < this.state.currentFilters.length; i++) {
        this.handleColumnFilter(this.state.currentFilters[i].colDef, this.state.currentFilters[i].filterText, true);
    }
    this.setState({rootNode: this.state.rootNode});
}

function ReactTableHandleClearSubtotal(event) {
    event.stopPropagation();
    const newState = this.state;
    newState.currentPage = 1;
    newState.lowerVisualBound = 0;
    newState.upperVisualBound = this.props.pageSize;
    newState.firstColumnLabel = buildFirstColumnLabel(this);
    /**
     * do not set subtotalBy or sortBy to blank array - simply pop all elements off, so it won't disrupt external reference
     */
    const subtotalBy = this.state.subtotalBy;
    while (subtotalBy.length > 0)
        subtotalBy.pop();
    newState.subtotalBy = subtotalBy;
    newState.rootNode = createNewRootNode(this.props, newState);
    /**
     * subtotaling destroys sort, so here we re-apply sort
     */
    if (this.state.sortBy.length > 0)
        newState.rootNode.sortNodes(convertSortByToFuncs(this.state.columnDefs, this.state.sortBy));
    this.setState(newState);
}

function ReactTableHandleSubtotalBy(columnDef, partitions, event) {
    event.stopPropagation();
    const subtotalBy = this.state.subtotalBy || [];
    /**
     * determine if the subtotal operation require partitioning of the column values first
     */
    if (partitions != null && partitions != "" && columnDef)
        columnDef.subtotalByRange = partitionNumberLine(partitions);

    /**
     * make sure a valid column def is passed in
     */
    if (columnDef != null && columnDef.constructor.name != 'SyntheticMouseEvent')
        subtotalBy.push(columnDef);

    // TODO Chris - what is this?
    if (this.state.currentFilters.length > 0)
        applyAllFilters.call(this);

    /**
     * extend the current state to derive new state after subtotal operation, then create a new rootNode
     */
    const newState = this.state;
    newState.currentPage = 1;
    newState.lowerVisualBound = 0;
    newState.upperVisualBound = this.props.pageSize;
    newState.firstColumnLabel = buildFirstColumnLabel(this);
    newState.subtotalBy = subtotalBy;
    newState.rootNode = createNewRootNode(this.props, newState);
    /**
     * subtotaling destroys sort, so here we re-apply sort
     */
    if (this.state.sortBy.length > 0)
        newState.rootNode.sortNodes(convertSortByToFuncs(this.state.columnDefs, this.state.sortBy));
    this.setState(newState);
}

function ReactTableHandleAdd() {
    if (this.props.beforeColumnAdd)
        this.props.beforeColumnAdd(this);
}

function ReactTableHandleRemove(columnDefToRemove) {
    var loc = this.state.columnDefs.indexOf(columnDefToRemove);
    var newColumnDefs = [];
    for (var i = 0; i < this.state.columnDefs.length; i++) {
        if (i != loc)
            newColumnDefs.push(this.state.columnDefs[i]);
    }
    this.setState({
        columnDefs: newColumnDefs
    });
    // TODO pass copies of these variables to avoid unintentional perpetual binding
    if (this.props.afterColumnRemove != null)
        this.props.afterColumnRemove(newColumnDefs, columnDefToRemove);
}

function ReactTableHandleToggleHide(summaryRow, event) {
    event.stopPropagation();
    summaryRow.treeNode.collapsed = !summaryRow.treeNode.collapsed;
    this.setState({});
}

function ReactTableHandlePageClick(page) {
    this.setState({
        currentPage: page
    });

}

function ReactTableHandleShowAllRows(){
    $(this.getDOMNode()).find(".rt-scrollable").get(0).addEventListener('scroll', this.handleScroll);
    this.setState({
        disableInfiniteScrolling: false,
        disablePagination: true,
        pageSize: 50,
        upperVisualBound: 50
    });
}

/*
 * ----------------------------------------------------------------------
 * Helpers
 * ----------------------------------------------------------------------
 */
function partitionNumberLine(partitions) {
    var i, stringBuckets, floatBuckets = [];
    stringBuckets = partitions.split(",");
    for (i = 0; i < stringBuckets.length; i++) {
        var floatBucket = parseFloat(stringBuckets[i]);
        if (!isNaN(floatBucket))
            floatBuckets.push(floatBucket);
        floatBuckets.sort(function (a, b) {
            return a - b;
        });
    }
    return floatBuckets;
}

function buildFirstColumnLabel(table) {
    var result = [];
    if (table.state.subtotalBy) {
        for (var i = 0; i < table.state.subtotalBy.length; i++)
            result.push(table.state.subtotalBy[i].text);
    }
    result.push(table.state.columnDefs[0].text);
    return result;
}

function getInitialSelections(selectedRows, selectedSummaryRows) {
    var results = {selectedDetailRows: {}, selectedSummaryRows: {}};
    if (selectedRows != null) {
        for (var i = 0; i < selectedRows.length; i++)
            results.selectedDetailRows[selectedRows[i]] = 1;
    }
    if (selectedSummaryRows != null) {
        for (var i = 0; i < selectedSummaryRows.length; i++)
            results.selectedSummaryRows[selectedSummaryRows[i]] = 1;
    }
    return results;
}
