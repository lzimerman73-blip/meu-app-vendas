import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from "react-native";
import {
  List,
  Surface,
  Title,
  Avatar,
  Text,
  Searchbar,
} from "react-native-paper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../api/api";

interface Empresa {
  codigo: string;
  filial: string;
  nome: string;
  descFilial: string;
}

interface Props {
  onConfirm: () => void;
  route: any;
}

const SelecaoEmpresaScreen: React.FC<Props> = ({ onConfirm, route }) => {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [filteredEmpresas, setFilteredEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    carregarEmpresas();
  }, []);

 const carregarEmpresas = async () => {
    try {
      setLoading(true);
      // Verificamos se o vendedorId veio pela rota ou pelo storage
      const storageVendedorId = await AsyncStorage.getItem("@vendedor_id");
      const vendedorId = route.params?.vendedorId || storageVendedorId || "admin";

      console.log(`🔍 Buscando empresas para o vendedor: ${vendedorId}`);

      // Chamada da API
      const data = await buscarEmpresasDinamico(vendedorId);

      if (!data || data.length === 0) {
        Alert.alert("Aviso", "Nenhuma empresa vinculada a este vendedor.");
      }

      setEmpresas(data);
      setFilteredEmpresas(data);
    } catch (error: any) {
      console.error("ERRO NA BUSCA DINÂMICA:", error);
      
      // DIAGNÓSTICO PARA O APK:
      const errorMsg = error.response 
        ? `Status: ${error.response.status} - ${JSON.stringify(error.response.data)}` 
        : error.message;

      Alert.alert(
        "Erro na Conexão",
        `Não foi possível carregar as empresas.\n\nDetalhe técnico: ${errorMsg}`
      );
    } finally {
      setLoading(false);
    }
  };

  const onChangeSearch = (query: string) => {
    setSearchQuery(query);
    const filtered = empresas.filter(
      (item) =>
        item.descFilial.toLowerCase().includes(query.toLowerCase()) ||
        item.filial.includes(query),
    );
    setFilteredEmpresas(filtered);
  };

  const selecionarEmpresa = async (item: Empresa) => {
    try {
      await AsyncStorage.setItem("@empresa_ativa", item.codigo);
      await AsyncStorage.setItem("@filial_ativa", item.filial);
      await AsyncStorage.setItem("@nome_empresa_ativa", item.nome);
      await AsyncStorage.setItem("@desc_filial_ativa", item.descFilial);
      onConfirm();
    } catch (e) {
      Alert.alert("Erro", "Falha ao salvar a seleção.");
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#005492" />
        <Text style={{ marginTop: 10 }}>Carregando unidades...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Surface style={styles.header}>
        <Title style={styles.headerTitle}>Unidades Protheus</Title>
        <Text style={styles.headerSubtitle}>
          Selecione a filial para operação
        </Text>
      </Surface>

      <Searchbar
        placeholder="Buscar unidade ou filial"
        onChangeText={onChangeSearch}
        value={searchQuery}
        style={styles.searchBar}
      />

      <FlatList
        data={filteredEmpresas}
        keyExtractor={(item) => `${item.codigo}-${item.filial}`}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Surface style={styles.card}>
            <List.Item
              // Título: Filial em Negrito Azul
              title={`Filial ${item.filial}`}
              titleStyle={styles.cardTitleHighlight}
              // Descrição: Nome da Empresa na linha de baixo
              description={item.descFilial}
              descriptionStyle={styles.cardDescription}
              style={{ paddingLeft: 12 }}
              left={(props) => (
                <Avatar.Icon
                  {...props}
                  icon="office-building"
                  size={48}
                  style={styles.avatarIcon}
                  color="#005492"
                />
              )}
              right={(props) => (
                <List.Icon {...props} icon="chevron-right" color="#ccc" />
              )}
              onPress={() => selecionarEmpresa(item)}
            />
          </Surface>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    padding: 25,
    backgroundColor: "#005492",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 4,
  },
  headerTitle: { color: "#fff", fontWeight: "bold", fontSize: 22 },
  headerSubtitle: { color: "#fff", opacity: 0.8 },
  searchBar: {
    margin: 16,
    borderRadius: 10,
    backgroundColor: "#fff",
  },
  listContent: { paddingHorizontal: 16, paddingBottom: 20 },
  card: {
    borderRadius: 12,
    backgroundColor: "#fff",
    elevation: 2,
    marginBottom: 4,
  },
  // Estilo solicitado: Negrito e Azul para o título (Filial)
  cardTitleHighlight: {
    fontWeight: "bold",
    color: "#005492",
    fontSize: 16,
  },
  cardDescription: {
    color: "#444",
    fontSize: 13,
    marginTop: 2,
  },
  avatarIcon: {
    backgroundColor: "#e3f2fd",
  },
});

export default SelecaoEmpresaScreen;
