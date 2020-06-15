const nameSelectJQuery = $(".node-select");
const typeSelectJQuery = $("#type-select");

const nodeQuery = $("#node-query");
const ignoreQuery = $("#ignore-query");
const allConnections = $("#all-connections-button button");
const minConnections = $("#min");

const nameSelectD3 = d3.select("#name-select");
const newNameSelectD3 = d3.select("#new-name-select");
const typeSelectD3 = d3.select("#type-select");
const auxNode = $("#aux-button button");

const nodes = [];
const edges = [];

const allNames = new Set();
const allNewNames = new Set();
const allTypes = new Set();
const selectedNames = new Set();
const selectedTypes = new Set();

const parseDate = d3.timeParse("%Y-%m-%d");
const formatDate = d3.timeFormat("%Y-%m-%d");
const formatDateTime = d3.timeFormat("%b %d %Y %H:%M:%S");

let dateRange = [];
let dateExtent = null;

let dataTable = null;

/**
 * Parse query values, make request, and process query response. Initialize data structures and handlers for the plots.
 */
async function parseData()
{
    let queryOptions = parseQueryOptions();
    let rows
    try
    {
        rows = await makeRequest(queryOptions[0], queryOptions[1], queryOptions[2], queryOptions[3]);
    }
    catch(e)
    {
        window.alert(e);
        return;
    }

    let tempNames = new Set();
    allNames.forEach(d => tempNames.add(d));
    allNewNames.forEach(d => tempNames.add(d));
    reset();

    let tempNodes = {};
    rows.forEach(d =>
    {
        allNames.add(d.source);
        allNames.add(d.target);
        allTypes.add(d.type);

        // Create entry for node if it does not yet exist. Avoid duplicate entries.
        tempNodes[d.source] || (tempNodes[d.source] = {"name": d.source});
        tempNodes[d.target] || (tempNodes[d.target] = {"name": d.target});

        d.date = new Date(d.datetime);
        edges.push({"source": tempNodes[d.source], "target": tempNodes[d.target], "date": d.date, "type": d.type});
    });

    // Push all node objects into the nodes array.
    Object.values(tempNodes).forEach(d => nodes.push(d));

    // Remove names that have previously appeared from allNames and add them to allNewNames.
    allNames.forEach(d =>
    {
        if(!tempNames.has(d))
        {
            allNames.delete(d);
            allNewNames.add(d);
        }
    })

    initPlotData(rows);
    calculateTotals();
}

/**
 * Make request to the server using the given query parameters. Retrieve and return query results.
 * @param nodes A list of the network nodes to include in the query request.
 * @param ignore A list of the network nodes to ignore in the query request.
 * @param min The minimum number of connections a node should have in the query request.
 * @param all Include all connections for all queried nodes if true. Else, only return connections chosen by the server.
 * @throws Throws an error if the server indicates too many interactions were returned by the query.
 * @returns {Promise<any>} The query results containing rows of network data.
 */
async function makeRequest(nodes, ignore, min, all)
{
    let options = {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({'nodes': nodes, 'ignore': ignore, 'min': min, 'all': all})
    };

    let response = await fetch(fetchURL, options);
    if(response.status === 430)
    {
        throw "Too many interactions to display.";
    }
    return await response.json();
}

/**
 * Extract query option values from the user interface.
 * @returns {(*|string)[]}
 */
function parseQueryOptions()
{
    return [
        nodeQuery.select2('data'),
        ignoreQuery.select2('data'),
        minConnections.val(),
        allConnections.hasClass('active')
    ];
}

/**
 * Initialize data and data handlers from the queried network rows.
 * @param rows The queried network rows.
 */
function initPlotData(rows)
{
    dateExtent = d3.extent(rows, d => parseDate(formatDate(d.date)));
    dateExtent[0] = d3.timeDay.offset(dateExtent[0], -7);
    dateExtent[1] = d3.timeDay.offset(dateExtent[1], 7);

    allNames.forEach(d => selectedNames.add(d));
    allNewNames.forEach(d => selectedNames.add(d));
    allTypes.forEach(d => selectedTypes.add(d));

    // Create buttons for each queried node name and type.
    nameSelectD3.selectAll("button:not(.keep)").data(Array.from(allNames)).join("button")
        .on("click", updateNameSelect).attr("data-toggle", "button")
        .attr("class", "col btn btn btn-light active").attr("onclick", "this.blur();").text(d => d);

    newNameSelectD3.selectAll("button:not(.keep)").data(Array.from(allNewNames)).join("button")
        .on("click", updateNameSelect).attr("data-toggle", "button")
        .attr("class", "col btn btn btn-light active").attr("onclick", "this.blur();").text(d => d);

    typeSelectD3.selectAll("button:not(.keep)").data(Array.from(allTypes)).join("button")
        .on("click", updateTypeSelect).attr("data-toggle", "button")
        .attr("class", "col btn btn btn-light active").attr("onclick", "this.blur();").text(d => d);
}

/**
 * Reset all data structures.
 */
function reset()
{
    allNames.clear();
    allNewNames.clear();
    allTypes.clear();
    selectedNames.clear();
    selectedTypes.clear();
    nodes.length = 0;
    edges.length = 0;
    dateRange = [];
    brushSelection = null;
    dateExtent = null;
    dateScale = null;
    brush = null;
    filteredEdges = null;
}

/**
 * Toggle the selection of the given node name.
 * @param name The node name to toggle.
 */
function updateNameSelect(name)
{
    selectedNames.has(name) ? selectedNames.delete(name) : selectedNames.add(name);
    calculateTotals();
}

/**
 * Toggle the selection of the given node type.
 * @param type The node type to toggle.
 */
function updateTypeSelect(type)
{
    selectedTypes.has(type) ? selectedTypes.delete(type) : selectedTypes.add(type);
    calculateTotals();
}

function selectAllNames()
{
    allNames.forEach(d => selectedNames.add(d));
    allNewNames.forEach(d => selectedNames.add(d));
    nameSelectJQuery.find("button:not(.active):not(.keep)").addClass("active");
    calculateTotals();
}

function selectAllTypes()
{
    allTypes.forEach(d => selectedTypes.add(d));
    typeSelectJQuery.find("button:not(.active):not(.keep)").addClass("active");
    calculateTotals();
}

function removeAllNames()
{
    allNames.forEach(d => selectedNames.delete(d));
    allNewNames.forEach(d => selectedNames.delete(d));
    nameSelectJQuery.find("button.active").removeClass("active");
    calculateTotals();
}

function removeAllTypes()
{
    allTypes.forEach(d => selectedTypes.delete(d));
    typeSelectJQuery.find("button.active").removeClass("active");
    calculateTotals();
}

function updateTable()
{
    let tableEdges = [];
    edges.forEach(function(d)
    {
        if(d.date >= dateRange[0] && d.date <= dateRange[1] && selectedTypes.has(d.type))
        {
            let hasNode = auxNode.hasClass('active') ?
                selectedNames.has(d.source.name) || selectedNames.has(d.target.name) :
                selectedNames.has(d.source.name) && selectedNames.has(d.target.name);

            if(hasNode)
            {
                tableEdges.push([d.source.name, d.target.name, d.type, formatDateTime(d.date)]);
            }
        }
    });

    dataTable.clear();
    tableEdges.forEach(d => dataTable.row.add(d));
    dataTable.draw();
}

$(document).ready(function()
{
    nodeQuery.select2({
        ajax: {
            url: nodeURL,
            dataType: 'json',
            delay: 500,
            cache: true,
        },
        minimumInputLength: 1,
        placeholder: 'Search for a node',
        cache: true
    });

    ignoreQuery.select2({
        ajax: {
            url: nodeURL,
            dataType: 'json',
            delay: 500,
            cache: true,
        },
        minimumInputLength: 1,
        placeholder: 'Search for a node',
        cache: true
    });

    auxNode.on("click", () =>
    {
        auxNode.hasClass("active") ? auxNode.removeClass("active") : auxNode.addClass("active");
        calculateTotals();
        updateTable();
    });

    allConnections.on("click", () =>
    {
        allConnections.hasClass("active") ? allConnections.removeClass("active") : allConnections.addClass("active");
    });

    forceOptions.on("input", updateForces);

    $.fn.dataTable.moment("MMM D YYYY H:m:s");

    dataTable = $("#summary-table").DataTable({
        columns: [{title: "Source"}, {title: "Target"}, {title: "Type"}, {title: "Datetime"}],
        order: [3, "asc"],
        bLengthChange: false,
        info: false,
        deferRender: true
    });
});