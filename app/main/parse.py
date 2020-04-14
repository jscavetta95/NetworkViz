import networkx as nx
import pandas as pd

df = pd.read_feather("data/data.feather").rename({'destination': 'target', 'etype': 'type',
                                                  'time_stamp': 'datetime'}, axis=1)
graph = nx.read_gpickle("data/graph.gpickle")
all_nodes = df.source.append(df.target).unique().to_list()


def find_connected_nodes(selected_nodes):
    possible_people_to_consider = set(selected_nodes)
    list_of_connections = set()

    for previous, current in zip(selected_nodes[:-1], selected_nodes[1:]):
        list_of_connections = list_of_connections | set(nx.common_neighbors(graph, previous, current))

    possible_connections = list_of_connections.union(possible_people_to_consider)

    if possible_connections == possible_people_to_consider:
        return df[df['source'].isin(possible_people_to_consider) | df['target'].isin(possible_people_to_consider)]
    else:
        return df[df['source'].isin(possible_connections) & df['target'].isin(possible_connections)]
