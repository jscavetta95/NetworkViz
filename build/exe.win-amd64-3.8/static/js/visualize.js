/** JQuery selectors. */
const nameSelectJQuery = $(".node-select");
const typeSelectJQuery = $("#type-select");
const nodeQuery = $("#node-query");
const ignoreQuery = $("#ignore-query");
const allConnections = $("#all-connections-button button");
const minConnections = $("#min");
const auxNode = $("#aux-button button");
const forceOptions = $("#force-options input");
const networkGraphJQuery = $("#network")
const totalsGraphJQuery = $("#totals");
const summaryTableJQuery = $("#summary-table");

/** D3 selectors. */
const networkGraphD3 = d3.select("#network");
const totalsGraphD3 = d3.select("#totals")
const nameSelectD3 = d3.select("#name-select");
const newNameSelectD3 = d3.select("#new-name-select");
const typeSelectD3 = d3.select("#type-select");
const dragHandler = d3.drag().on("start", dragstart).on("drag", drag).on("end", dragend);

/** Datetime formats. */
const parseDate = d3.timeParse("%Y-%m-%d");
const formatDate = d3.timeFormat("%Y-%m-%d");
const formatDateTime = d3.timeFormat("%b %d %Y %H:%M:%S");

/** Data structures. */
let allNames = new Set();
let allNewNames = new Set();
const allTypes = new Set();
const selectedNames = new Set();
const selectedTypes = new Set();
const nodes = [];
const edges = [];

/** Global variables. */
let dateRange = [];
let brushSelection = null;
let dateExtent = null;
let dateScale = null;
let brush = null;
let dataTable = null;
let filteredEdges = null;

/** Network forces. */
const force = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(edges).id(d => d.id))
    .force("charge", d3.forceManyBody())
    .force("collide", d3.forceCollide().strength(1).radius(5))
    .force("x", d3.forceX(networkGraphJQuery.width() / 2))
    .force("y", d3.forceY(networkGraphJQuery.height() / 2))
    .on("tick", tickForces);

updateForces();

function updateForces()
{
    force.force("charge").strength($("#charge-strength").val()).distanceMax($("#charge-max").val());
    force.force("x").strength($("#x-strength").val());
    force.force("y").strength($("#y-strength").val());
    force.force("link").distance($("#link-distance").val());
    force.alpha(1).restart();
}

/** Plotting functions. */
function plotTotals(totals)
{
    let margin = {t: 10, r: 10, b: 20, l: 25};

    dateScale = dateScale || d3.scaleTime()
        .domain(dateExtent)
        .range([margin.l, totalsGraphJQuery.width() - margin.r]);

    let yScale = d3.scaleLinear()
        .domain([0, d3.max(totals, d => d.total) * 1.1])
        .range([totalsGraphJQuery.height() - margin.b, margin.t]);

    brush = d3.brushX()
        .extent([[margin.l, margin.t], [totalsGraphJQuery.width() - margin.r, totalsGraphJQuery.height() - margin.b]])
        .on("brush", () =>
        {
            brushSelection = [d3["event"]["selection"][0], d3["event"]["selection"][1]]
            dateRange = [dateScale.invert(brushSelection[0]), dateScale.invert(brushSelection[1])]
            plotNetwork();
        }).on("end", () =>
        {
            updateTable();
        });

    totalsGraphD3.select("#brush")
        .call(brush)
        .call(brush.move, brushSelection || [margin.l, totalsGraphJQuery.width() - margin.r]);

    totalsGraphD3.select("#x-axis")
        .attr("transform", `translate(0, ${totalsGraphJQuery.height() - margin.b})`)
        .call(d3.axisBottom(dateScale).tickFormat(d3.timeFormat("%m-%Y")));

    totalsGraphD3.select("#y-axis")
        .attr("transform", `translate(${margin.l}, 0)`)
        .call(d3.axisLeft(yScale));

    totalsGraphD3.select("#scatter").selectAll("circle").data(totals).join("circle")
        .attr("r", 2).attr("cx", d => dateScale(d.date)).attr("cy", d => yScale(d.total));
}

function plotNetwork()
{
    filteredEdges = filterEdges();
    let filteredNodes = filterNodes(filteredEdges);

    let edgeScale = d3.scaleLinear()
        .domain([d3.min(filteredEdges, d => d.total), d3.max(filteredEdges, d => d.total)])
        .range([1, 5]);

    networkGraphD3.select("#edges").selectAll(".edge")
        .data(filteredEdges)
        .join(
            enter =>
            {
                let g = enter.append("g").attr("class", "edge");
                g.append("line").attr("class", "path")
                    .style("stroke", "#ccc").style("stroke-width", d => edgeScale(d.total));
                g.append("text").attr("class", "label").text(d => d.total);
            },
            update =>
            {
                update.select("line").style("stroke", "#ccc").style("stroke-width", d => edgeScale(d.total));
                update.select("text").text(d => d.total);
            },
            exit => exit.remove());

    networkGraphD3.select("#nodes").selectAll(".node")
        .data(filteredNodes)
        .join(
            enter =>
            {
                let g = enter.append("g").attr("class", "node").call(dragHandler).on("click", d => clickToggle(d.name))
                g.append("circle").attr("r", 5).style("fill", d => selectedNames.has(d.name) ? "red" : "black")
                    .on('mouseover.fade', d => fade(d, 0.1))
                    .on('mouseout.fade', d => fade(d, 1));
                g.append("text").text(d => d.name);
            },
            update =>
            {
                update.select("circle").attr("r", 5).style("fill", d => selectedNames.has(d.name) ? "red" : "black");
                update.select("text").text(d => d.name);
            },
            exit => exit.remove());

    force.nodes(filteredNodes);
    force.force("link").links(filteredEdges);
    force.alpha(1).alphaTarget(0).restart();
}

function fade(n, opacity)
{
    networkGraphD3.select("#nodes").selectAll(".node")
        .style('fill-opacity', d => n === d || isConnected(n, d) ? 1 : opacity);

    networkGraphD3.select("#edges").selectAll(".edge")
        .style('stroke-opacity', e => (e.source === n || e.target === n ? 1 : opacity))
        .style('fill-opacity', e => (e.source === n || e.target === n ? 1 : opacity));
}

function isConnected(a, b)
{
    return filteredEdges.find(d => (d.source === a && d.target === b) || (d.source === b && d.target === a));
}

/** Data reading-transformation functions. */

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

async function parseData()
{
    let options = {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            'nodes': nodeQuery.select2('data'),
            'ignore': ignoreQuery.select2('data'),
            'min': minConnections.val(),
            'all': allConnections.hasClass('active')
        })
    };

    let response = await fetch(fetchURL, options);
    if(response.status === 430)
    {
        window.alert("Too many interactions to display.");
        return;
    }
    let rows = await response.json();

    let tempNames = new Set();
    allNames.forEach(d => tempNames.add(d));
    allNewNames.forEach(d => tempNames.add(d));
    reset();

    let tempNodes = {};
    rows.forEach(d =>
    {
        d.date = new Date(d.datetime);
        allNames.add(d.source);
        allNames.add(d.target);
        allTypes.add(d.type);
        tempNodes[d.source] || (tempNodes[d.source] = {"name": d.source});
        tempNodes[d.target] || (tempNodes[d.target] = {"name": d.target});
        edges.push({"source": tempNodes[d.source], "target": tempNodes[d.target], "date": d.date, "type": d.type});
    });

    allNewNames = new Set([...allNames].filter(x => !tempNames.has(x)));
    allNames = new Set([...allNames].filter(x => !allNewNames.has(x)));

    dateExtent = d3.extent(rows, d => parseDate(formatDate(d.date)));
    dateExtent[0] = d3.timeDay.offset(dateExtent[0], -7);
    dateExtent[1] = d3.timeDay.offset(dateExtent[1], 7);

    Object.values(tempNodes).forEach(d => nodes.push(d));
    allNames.forEach(d => selectedNames.add(d));
    allNewNames.forEach(d => selectedNames.add(d));
    allTypes.forEach(d => selectedTypes.add(d));

    nameSelectD3.selectAll("button:not(.keep)").data(Array.from(allNames)).join("button")
        .on("click", updateNameSelect).attr("data-toggle", "button")
        .attr("class", "col btn btn btn-light active").attr("onclick", "this.blur();").text(d => d);

    newNameSelectD3.selectAll("button:not(.keep)").data(Array.from(allNewNames)).join("button")
        .on("click", updateNameSelect).attr("data-toggle", "button")
        .attr("class", "col btn btn btn-light active").attr("onclick", "this.blur();").text(d => d);

    typeSelectD3.selectAll("button:not(.keep)").data(Array.from(allTypes)).join("button")
        .on("click", updateTypeSelect).attr("data-toggle", "button")
        .attr("class", "col btn btn btn-light active").attr("onclick", "this.blur();").text(d => d);

    calculateTotals();
}

function calculateTotals()
{
    let totals = {};
    edges.forEach(d =>
    {
        if(auxNode.hasClass('active'))
        {
            if((selectedNames.has(d.source.name) || selectedNames.has(d.target.name)) && selectedTypes.has(d.type))
            {
                let date = formatDate(d.date);
                totals[date] ? totals[date].total++ : totals[date] = {"date": parseDate(date), "total": 1};
            }
        }
        else
        {
            if((selectedNames.has(d.source.name) && selectedNames.has(d.target.name)) && selectedTypes.has(d.type))
            {
                let date = formatDate(d.date);
                totals[date] ? totals[date].total++ : totals[date] = {"date": parseDate(date), "total": 1};
            }
        }
    });

    plotTotals(Object.values(totals).sort((a, b) => { return a.date - b.date; }));
}

function filterEdges()
{
    let filteredEdges = {};
    edges.forEach(function(d)
    {
        if(d.date >= dateRange[0] && d.date <= dateRange[1] && selectedTypes.has(d.type))
        {
            let hasNode = auxNode.hasClass('active') ?
                selectedNames.has(d.source.name) || selectedNames.has(d.target.name) :
                selectedNames.has(d.source.name) && selectedNames.has(d.target.name);

            if(hasNode)
            {
                let hashForward = `${d.source.name}_${d.target.name}`;
                let hashBackward = `${d.target.name}_${d.source.name}`;

                if(filteredEdges[hashForward]) filteredEdges[hashForward].total++;
                else if(filteredEdges[hashBackward]) filteredEdges[hashBackward].total++;
                else filteredEdges[hashForward] = {source: d.source, target: d.target, total: 1};
            }
        }
    });

    return Object.values(filteredEdges);
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

function filterNodes(filteredEdges)
{
    return nodes.filter(function(d)
    {
        return filteredEdges.filter(edge => edge.source.name === d.name || edge.target.name === d.name).length > 0;
    })
}

/** Event callbacks. */

function updateNameSelect(name)
{
    selectedNames.has(name) ? selectedNames.delete(name) : selectedNames.add(name);
    calculateTotals();
}

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

function updateDateRange(newRange)
{
    let newSelection;
    switch(newRange)
    {
        case "full":
            let overlay = totalsGraphJQuery.find("#brush .overlay");
            let margin = overlay.prop("x").baseVal.value
            newSelection = [margin, overlay.prop("width").baseVal.value + margin];
            break;
        case "2week":
            newSelection = [brushSelection[0], dateScale(d3.timeWeek.offset(dateScale.invert(brushSelection[0]), 2))];
            break;
        case "month":
            newSelection = [brushSelection[0], dateScale(d3.timeMonth.offset(dateScale.invert(brushSelection[0]), 1))];
            break;
        case "quarter":
            newSelection = [brushSelection[0], dateScale(d3.timeMonth.offset(dateScale.invert(brushSelection[0]), 3))];
            break;
        case "6month":
            newSelection = [brushSelection[0], dateScale(d3.timeMonth.offset(dateScale.invert(brushSelection[0]), 6))];
            break;
        case "year":
            newSelection = [brushSelection[0], dateScale(d3.timeYear.offset(dateScale.invert(brushSelection[0]), 1))];
            break;
    }

    totalsGraphD3.select("#brush").call(brush.move, newSelection);
}

function dragstart(d)
{
    if(!d3.event.active) force.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
}

function drag(d)
{
    d.fx = d3.event.x;
    d.fy = d3.event.y;
}

function dragend(d)
{
    if(!d3.event.active) force.alphaTarget(0);
    d.fx = null;
    d.fy = null;
}

function tickForces()
{
    networkGraphD3.selectAll(".edge .path")
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);
    networkGraphD3.selectAll(".edge .label")
        .attr("x", d => (d.source.x + d.target.x) / 2)
        .attr("y", d => (d.source.y + d.target.y) / 2);
    networkGraphD3.selectAll(".node")
        .attr("transform", d => `translate(${d.x}, ${d.y})`);
}

function clickToggle(name)
{
    nameSelectJQuery.find(`button:contains(${name})`).toggleClass("active");
    updateNameSelect(name);
}

/** JQuery binding. */
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

    dataTable = summaryTableJQuery.DataTable({
        columns: [{title: "Source"}, {title: "Target"}, {title: "Type"}, {title: "Datetime"}],
        order: [3, "asc"],
        bLengthChange: false,
        info: false,
        deferRender: true
    });
});