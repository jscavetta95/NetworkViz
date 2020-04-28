import itertools

import pandas as pd


class GraphParser:

    def __init__(self):
        self.df = None
        self.all_nodes = None

    def load_data(self, filename):
        if '.feather' in filename:
            self.df = pd.read_feather(filename)
        elif '.csv' in filename:
            self.df = pd.read_csv(filename)

        self.df.rename(columns={self.df.columns[0]: "source", self.df.columns[1]: "target",
                                self.df.columns[2]: "type", self.df.columns[3]: "datetime"}, inplace=True)
        self.all_nodes = self.df.source.append(self.df.target).unique().tolist()

    def common_neighbors(self, previous, current):
        previous_connected = self.df[(self.df.source == previous) | (self.df.target == previous)]
        previous_connected = set(previous_connected.source.append(previous_connected.target).unique())
        current_connected = self.df[(self.df.source == current) | (self.df.target == current)]
        current_connected = set(current_connected.source.append(current_connected.target).unique())
        return previous_connected & current_connected

    def find_connected_nodes(self, selected_nodes, ignore_list, min_connections, all_connections):
        node_set = set(selected_nodes)
        ignore_set = set(ignore_list)
        connection_set = set()

        for previous, current in itertools.combinations(selected_nodes, 2):
            connection_set = connection_set | self.common_neighbors(previous, current)

        all_nodes = connection_set.union(node_set)
        all_nodes = all_nodes.difference(ignore_set)

        if all_connections or all_nodes == node_set:
            results = self.df.loc[self.df.source.isin(all_nodes) | self.df.target.isin(all_nodes), :]
            results = results[~(results.source.isin(ignore_set) | results.target.isin(ignore_set))]
        else:
            results = self.df.loc[self.df.source.isin(all_nodes) & self.df.target.isin(all_nodes), :]

        if results.source.dtype.name == 'category':
            filtered = results.source.append(results.target).cat.remove_unused_categories()
        else:
            filtered = results.source.append(results.target)

        filtered = filtered.groupby(filtered).filter(lambda x: len(x) >= min_connections).unique().tolist()

        return results.loc[results.source.isin(filtered) & results.target.isin(filtered), :]

    def loaded(self):
        return self.df is not None
