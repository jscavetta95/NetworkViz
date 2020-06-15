const totalsGraphD3 = d3.select("#totals")
const totalsGraphJQuery = $("#totals");
let brushSelection = null;
let dateScale = null;
let brush = null;

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