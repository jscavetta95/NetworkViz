/** JQuery selectors. */
const fileSelect = $("#file-select");
const dropArea = $("#drop-area");

const nameSelect = $("#name-select");
const typeSelect = $("#type-select");
const updateButton = $("#update-button");

const auxNode = $("#show-aux-nodes");
const forceOptions = $("#force-options input");

const networkGraphJQuery = $("#network")
const totalsGraphJQuery = $("#totals");

/** D3 selectors. */
const networkGraphD3 = d3.select("#network");
const totalsGraphD3 = d3.select("#totals")

/** Datetime formats. */
const parseDate = d3.timeParse("%Y-%m-%d");
const formatDate = d3.timeFormat("%Y-%m-%d");
const parseDateTime = d3.timeParse("%Y-%m-%d %H:%M:%S");

/** Data structures. */
const connections = []
const selectedNames = new Set();
const selectedTypes = new Set();

/** Network variables. */
let nodes = [];
let edges = [];
let dateRange = [];

/** Network forces. */
const force = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(edges).id(d => d.id))
    .force("charge", d3.forceManyBody())
    .force("collide", d3.forceCollide().strength(1).radius(5))
    .force("x", d3.forceX(networkGraphJQuery.width() / 2))
    .force("y", d3.forceY(networkGraphJQuery.height() / 2))
    .on("tick", function()
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
    });

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
    let marginBottom = 20;

    let xScale = d3.scaleTime()
        .domain(d3.extent(totals, d => d.date))
        .range([0, totalsGraphJQuery.width()]);

    let yScale = d3.scaleLinear()
        .domain([0, d3.max(totals, d => d.total)])
        .range([totalsGraphJQuery.height() - marginBottom, 0]);

    let area = d3.area()
        .curve(d3.curveMonotoneX)
        .x(d => xScale(d.date))
        .y0(yScale(0))
        .y1(d => yScale(d.total));

    let brush = d3.brushX()
        .extent([[0, 0], [totalsGraphJQuery.width(), totalsGraphJQuery.height() - marginBottom]])
        .on("brush end", function()
        {
            dateRange = [xScale.invert(d3["event"]["selection"][0]), xScale.invert(d3["event"]["selection"][1])]
            plotNetwork();
        });

    totalsGraphD3.select("path").remove();
    totalsGraphD3.selectAll("g").remove();

    totalsGraphD3.append("path")
        .datum(totals)
        .attr("fill", "steelblue")
        .attr("d", area);

    totalsGraphD3.append("g")
        .attr("transform", `translate(0, ${totalsGraphJQuery.height() - marginBottom})`)
        .call(d3.axisBottom(xScale).tickFormat(d3.timeFormat("%m-%Y")));

    totalsGraphD3.append("g")
        .call(brush)
        .call(brush.move, [0, totalsGraphJQuery.width()]);
}

function plotNetwork()
{
    let filteredEdges = filterEdges();
    let filteredNodes = filterNodes(filteredEdges);

    networkGraphD3.selectAll(".edge")
        .data(filteredEdges)
        .join(
            enter =>
            {
                let g = enter.append("g").attr("class", "edge");
                g.append("line").attr("class", "path").style("stroke", "#ccc");
                g.append("text").attr("class", "label").text(d => d.total);
            },
            update =>
            {
                update.select("line").style("stroke", "#ccc");
                update.select("text").text(d => d.total);
            },
            exit => exit.remove());

    networkGraphD3.selectAll(".node")
        .data(filteredNodes)
        .join(
            enter =>
            {
                let g = enter.append("g").attr("class", "node").call(d3.drag()
                    .on("start", dragstart)
                    .on("drag", drag)
                    .on("end", dragend));
                g.append("circle").attr("r", 5).style("fill", d => selectedNames.has(d.name) ? "red" : "black");
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

/** Data reading-transformation functions. */
function parseData(fileURL)
{
    connections.length = 0;
    d3.csv(fileURL, d =>
    {
        return {
            "source": d.source,
            "target": d.target,
            "type": d.type,
            "datetime": parseDateTime(d.datetime)
        }
    }).then(function(data)
    {
        let nameSet = new Set();
        let typeSet = new Set();

        data.forEach(d =>
        {
            connections.push(d);
            nameSet.add(d.source);
            nameSet.add(d.target);
            typeSet.add(d.type);
        });

        let id = 0;
        let temp = [];
        nameSet.forEach(d => temp.push({id: ++id, text: d}))
        nameSelect.select2({data: temp, closeOnSelect: false});

        id = 0;
        temp = [];
        typeSet.forEach(d => temp.push({id: ++id, text: d}))
        typeSelect.select2({data: temp, closeOnSelect: false});
    });
}

function filterData()
{
    nodes = {};
    edges = [];
    let totals = {};
    connections.forEach(d =>
    {
        if((selectedNames.has(d.source) || selectedNames.has(d.target)) && selectedTypes.has(d.type))
        {
            let date = formatDate(d.datetime);
            totals[date] ? totals[date].total++ : totals[date] = {"date": parseDate(date), "total": 1};

            nodes[d.source] || (nodes[d.source] = {"name": d.source});
            nodes[d.target] || (nodes[d.target] = {"name": d.target});

            edges.push({"source": nodes[d.source], "target": nodes[d.target], "date": parseDate(date)});
        }
    });

    nodes = Object.values(nodes);
    plotTotals(Object.values(totals).sort((a, b) => { return a.date - b.date; }));
}

function filterEdges()
{
    let filteredEdges = {};
    edges.forEach(function(d)
    {
        if(d.date >= dateRange[0] && d.date <= dateRange[1])
        {
            if(auxNode.prop('checked') ? true : selectedNames.has(d.source.name) && selectedNames.has(d.target.name))
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

function filterNodes(filteredEdges)
{
    return nodes.filter(function(d)
    {
        return filteredEdges.filter(edge => edge.source.name === d.name || edge.target.name === d.name).length > 0;
    })
}

/** Event callbacks. */
function loadFile()
{
    let file = fileSelect.prop('files')[0];
    if(file)
    {
        let reader = new FileReader();
        reader.onloadend = function(e)
        {
            parseData(e.target.result);
        };
        reader.readAsDataURL(file);
    }
}

function preventDefaults(e)
{
    e.stopPropagation();
    e.preventDefault();
}

function updateNameSelect()
{
    selectedNames.clear();
    nameSelect.select2('data').forEach(d => selectedNames.add(d.text));
}

function updateTypeSelect()
{
    selectedTypes.clear();
    typeSelect.select2('data').forEach(d => selectedTypes.add(d.text));
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

/** JQuery binding. */
$(document).ready(function()
{
    nameSelect.select2().on("select2:close", updateNameSelect);
    typeSelect.select2().on("select2:close", updateTypeSelect);

    fileSelect.on("change", loadFile);
    dropArea.on({
        "dragenter": preventDefaults,
        "dragover": preventDefaults,
        'dragleave': preventDefaults,
        "drop": function(e)
        {
            preventDefaults(e);
            let files = e.originalEvent.dataTransfer.files;
            fileSelect.prop('files', files);
            loadFile();
        }
    });

    updateButton.on("click", filterData);

    auxNode.on("input", plotNetwork);
    forceOptions.on("input", updateForces);
});