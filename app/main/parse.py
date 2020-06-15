import itertools

import pandas as pd


class GraphParser:

    def __init__(self, filename):
        self.df = None
        self.all_nodes = None
        self.connection_dict = {}
        self.load_data(filename)

    def load_data(self, filename):
        """
        Read a CSV or Feather file into a data frame. The file must have 4 columns in this order: source, target, type,
        and datetime. Column names do not need to match and their may be extra columns that will be ignored.

        :param str filename: A CSV or Feather file containing network rows to read into a data frame.
        """
        if '.feather' in filename:
            self.df = pd.read_feather(filename)
        elif '.csv' in filename:
            self.df = pd.read_csv(filename)
        else:
            raise AttributeError("Cannot read file. File must be in CSV or Feather format.")

        if self.df.shape[1] < 4:
            raise ValueError("File contains less than 4 columns. Source, target, type, and datetime are required.")

        self.df.rename(columns={self.df.columns[0]: "source", self.df.columns[1]: "target",
                                self.df.columns[2]: "type", self.df.columns[3]: "datetime"}, inplace=True)
        self.all_nodes = self.df.source.append(self.df.target).unique().tolist()

    def find_connections(self, node):
        """
        Find all connections for the given node.

        :param str node: The node to find connections for.
        :return: The connection set for the given node.
        """
        connected = self.df[(self.df.source == node) | (self.df.target == node)]
        connected = set(connected.source.append(connected.target).unique())
        return connected

    def common_neighbors(self, previous, current):
        """
        Find common neighbors between two nodes. Check the cached connections dictionary first. If the node has not yet
        been cached, find all connections and create a new dictionary entry.

        :return: The intersection of both connection sets for the given two nodes.
        """
        if previous in self.connection_dict:
            previous_connected = self.connection_dict[previous]
        else:
            previous_connected = self.find_connections(previous)
            self.connection_dict[previous] = previous_connected

        if current in self.connection_dict:
            current_connected = self.connection_dict[current]
        else:
            current_connected = self.find_connections(current)
            self.connection_dict[current] = current_connected

        return previous_connected & current_connected

    def find_connected_nodes(self, selected_nodes, ignore_list, min_connections, all_connections):
        """
        Find nodes that are neighbors to at least two of the query nodes. Extract rows from the data frame using all
        requested nodes and their common neighbors. Nodes can be ignored to avoid detecting them as common neighbors.
        Node connections are also filtered by the number presences within the retrieved sub-network.

        If all connections is specified or no additional common neighbors are detected beyond the original query, all
        rows containing a selected node as either the target or source are retrieved. Otherwise, only rows with a
        selected node as both the target and source are retrieved.

        :param list selected_nodes: The nodes to consider when searching for common neighbors. Rows containing these
        nodes will be retrieved.
        :param list ignore_list: Nodes to ignore when searching for common neighbors. Rows containing an ignored node
        and a selected node will be retrieved, but rows containing only ignored nodes will never be retrieved.
        :param int min_connections: The minimum number of total connections two nodes must have to be included.
        :param bool all_connections: Always show all rows containing a selected node or a common neighbor if true, else
        only show all rows if no additional common neighbors are found.
        :return: A data frame containing the filtered rows for the given query parameters.
        """
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
