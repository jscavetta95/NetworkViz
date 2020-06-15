const networkGraphD3 = d3.select("#network");
const networkGraphJQuery = $("#network")
const forceOptions = $("#force-options input");
const dragHandler = d3.drag().on("start", dragstart).on("drag", drag).on("end", dragend);
let filteredEdges = null;


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
                g.append("text").text(d => d.name).attr("x", 5).attr("y", -5);
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

function filterNodes(filteredEdges)
{
    return nodes.filter(function(d)
    {
        return filteredEdges.filter(edge => edge.source.name === d.name || edge.target.name === d.name).length > 0;
    })
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

function clickToggle(name)
{
    nameSelectJQuery.find(`button:contains(${name})`).toggleClass("active");
    updateNameSelect(name);
}