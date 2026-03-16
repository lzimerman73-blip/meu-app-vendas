import React, { useState } from "react";
import { View, FlatList, StyleSheet } from "react-native";
import {
  List,
  Searchbar,
  Card,
  Text,
  ActivityIndicator,
  Divider,
  Button,
} from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import { useClientes, Cliente } from "../hooks/useClientes";

interface ClientesScreenProps {
  vendedorId: string;
}

const ClientesScreen: React.FC<ClientesScreenProps> = ({ vendedorId }) => {
  const { clientes, loading, refresh } = useClientes(vendedorId);
  const [searchQuery, setSearchQuery] = useState("");
  const navigation = useNavigation<any>();

  // --- FUNÇÃO DE FORMATAÇÃO DE CNPJ/CPF ---
  const formatarCNPJ = (val: string) => {
    if (!val) return "";
    const c = val.replace(/\D/g, "");
    if (c.length <= 11) {
      return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    return c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  };

  const filteredClientes = clientes.filter(
    (cliente) =>
      cliente.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cliente.codigo.includes(searchQuery),
  );

  const renderCliente = ({ item }: { item: Cliente }) => (
    <Card
      style={styles.card}
      onPress={() =>
        navigation.navigate("DetalhesCliente", {
          cliente: item,
          loja: item.loja,
          vendedorId: vendedorId,
        })
      }
    >
      <Card.Content>
        <View style={styles.headerRow}>
          <Text variant="titleMedium" style={styles.primaryColor}>
            {item.nome}
          </Text>
          <View style={styles.codeBadge}>
            <Text variant="labelSmall" style={styles.codeText}>
              {item.codigo} / {item.loja}
            </Text>
          </View>
        </View>

        <Text variant="bodyMedium" style={styles.secondaryText}>
          {item.fantasia}
        </Text>

        <Divider style={styles.divider} />

        <View style={styles.infoRow}>
          <List.Icon icon="map-marker" color="#666" />
          <Text variant="bodySmall">{`${item.cidade} - ${item.estado}`}</Text>
        </View>

        <View style={styles.infoRow}>
          <List.Icon icon="card-account-details" color="#666" />
          <Text variant="bodySmall" style={styles.infoText}>
            {formatarCNPJ(item.cnpj)}
          </Text>
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      {/* NOVO TOPO COM O BOTÃO DE PEDIDOS */}
      <View style={styles.topContainer}>
        <Text style={styles.tituloTela}>Meus Clientes</Text>
        <Button
          mode="contained-tonal"
          icon="clipboard-list-outline"
          buttonColor="#e3f2fd"
          textColor="#005492"
          onPress={() => navigation.navigate("PedidosOffline", { vendedorId })}
        >
          Pedidos Salvos
        </Button>
      </View>

      <Searchbar
        placeholder="Buscar cliente ou código..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchBar}
      />

      {loading ? (
        <ActivityIndicator
          animating={true}
          color="#005492"
          style={{ marginTop: 20 }}
        />
      ) : (
        <FlatList
          data={filteredClientes}
          keyExtractor={(item) => `${item.codigo}-${item.loja}`}
          renderItem={renderCliente}
          contentContainerStyle={styles.listContent}
          onRefresh={refresh}
          refreshing={loading}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Nenhum cliente encontrado.</Text>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  topContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 5,
  },
  tituloTela: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#005492",
  },
  searchBar: { margin: 10, elevation: 2, backgroundColor: "#fff" },
  listContent: { paddingBottom: 20 },
  card: {
    marginHorizontal: 10,
    marginBottom: 10,
    backgroundColor: "#fff",
    elevation: 3,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  primaryColor: {
    color: "#005492",
    fontWeight: "bold",
    flex: 1,
    paddingRight: 10,
  },
  codeBadge: {
    backgroundColor: "#e1e8ed",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  codeText: { color: "#444", fontWeight: "bold" },
  secondaryText: { color: "#757575", marginTop: 2 },
  divider: { marginVertical: 8 },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 30,
    marginLeft: -8,
  },
  infoText: { marginLeft: 8, color: "#444" },
  emptyText: { textAlign: "center", marginTop: 50, color: "#999" },
});

export default ClientesScreen;
