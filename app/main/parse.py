import itertools

import networkx as nx
import pandas as pd


class GraphParser:

    def __init__(self):
        print("Loading data, this may take a few minutes...")
        self.df = pd.read_feather("data/data.feather").rename({'destination': 'target', 'etype': 'type',
                                                               'time_stamp': 'datetime'}, axis=1)
        self.graph = nx.read_gpickle("data/graph.gpickle")
        self.all_nodes = self.df.source.append(self.df.target).unique().to_list()

    def find_connected_nodes(self, selected_nodes, ignore_list, min_connections, all_connections):
        node_set = set(selected_nodes)
        ignore_set = set(ignore_list)
        connection_set = set()

        for previous, current in itertools.combinations(selected_nodes, 2):
            connection_set = connection_set | set(nx.common_neighbors(self.graph, previous, current))

        all_nodes = connection_set.union(node_set)
        all_nodes = all_nodes.difference(ignore_set)

        if all_connections or all_nodes == node_set:
            results = self.df.loc[self.df.source.isin(all_nodes) | self.df.target.isin(all_nodes), :]
            results = results[~(results.source.isin(ignore_set) | results.target.isin(ignore_set))]
        else:
            results = self.df.loc[self.df.source.isin(all_nodes) & self.df.target.isin(all_nodes), :]

        filtered = results.source.append(results.target).cat.remove_unused_categories()
        filtered = filtered.groupby(filtered).filter(lambda x: len(x) >= min_connections).unique().to_list()

        return results.loc[results.source.isin(filtered) & results.target.isin(filtered), :]
