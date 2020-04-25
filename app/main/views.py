from flask import render_template, request, jsonify

from . import main
from .parse import GraphParser

graph_parse = GraphParser()


@main.route('/', methods=['GET', 'POST'])
def index():
    return render_template('index.html')


@main.route('/nodes', methods=['GET', 'POST'])
def nodes():
    term = request.args.get("term")
    if term is None:
        return '', 204
    else:
        term = term.lower()
        matched = [node for node in graph_parse.all_nodes if node.lower().startswith(term)]
        if len(matched) > 5000:
            return '', 204
        else:
            results = {"results": [{"id": node, "text": node} for node in matched]}
            return jsonify(results)


@main.route('/retrieve', methods=['POST'])
def filter_data():
    node_list = [node["text"] for node in request.get_json()['nodes']]
    ignore_list = [ignore["text"] for ignore in request.get_json()['ignore']]
    min_connections = int(request.get_json()['min'])
    all_connections = request.get_json()['all']

    interactions = graph_parse.find_connected_nodes(node_list, ignore_list, min_connections, all_connections)
    if interactions.shape[0] > 30000:
        return '', 430

    interactions_dict = interactions.to_dict(orient='records')
    return jsonify(interactions_dict)
