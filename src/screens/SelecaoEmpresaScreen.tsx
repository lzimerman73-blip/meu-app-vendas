import React, { useEffect, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
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
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
// IMPORTANTE: Importamos a nova função de busca dinâmica
import api, { buscarEmpresasDinamico } from "../api/api";

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
  const navigation = useNavigation<any>();

  useEffect(() => {
    carregarEmpresas();
  }, []);

  const carregarEmpresas = async () => {
    try {
      setLoading(true);
      const vendedorId = route.params?.vendedorId || "admin"; // Fallback para admin se vazio

      // --- MUDANÇA AQUI ---
      // Em vez de api.get direto, usamos o "Chaveiro" que criamos no api.ts
      const data = await buscarEmpresasDinamico(vendedorId);

      setEmpresas(data);
      setFilteredEmpresas(data);
    } catch (error: any) {
      console.error("ERRO NA BUSCA DINÂMICA:", error);
      Alert.alert(
        "Acesso Negado",
        "Não foi possível localizar nenhuma filial liberada para seu usuário no Protheus.",
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
    // 1. Extrai os códigos (Ex: "1202" -> "12" e "02")
    const codEmpresa = item.filial.substring(0, 2);
    const codFilial = item.filial.substring(2, 4);

    // 2. Salva no storage para o interceptor da API usar daqui pra frente
    await AsyncStorage.setItem("@empresa_ativa", codEmpresa);
    await AsyncStorage.setItem("@filial_ativa", codFilial);

    console.log(`📍 Empresa selecionada: ${codEmpresa} Filial: ${codFilial}`);

    // 3. EM VEZ DE navigation.navigate("Home"), use a prop onConfirm()
    // que você já definiu nas suas rotas. Ela vai te levar para "Clientes".
    if (onConfirm) {
      onConfirm();
    } else {
      // Caso o onConfirm falhe por algum motivo, forçamos a rota correta:
      navigation.replace("Clientes", { vendedorId: route.params?.vendedorId });
    }
  };

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
              title={`Filial ${item.filial}`}
              titleStyle={styles.cardTitleHighlight}
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
