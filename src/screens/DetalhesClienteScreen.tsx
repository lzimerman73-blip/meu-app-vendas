import React, { useEffect, useState, useCallback } from "react";
import {
  ScrollView,
  View,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import {
  List,
  Text,
  Surface,
  Divider,
  Caption,
  Headline,
  Button,
  Badge,
  SegmentedButtons,
} from "react-native-paper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import * as Location from "expo-location";
import api from "../api/api";

const DetalhesClienteScreen = ({ route, navigation }: any) => {
  const { cliente, loja, vendedorId } = route.params;
  const codCli = typeof cliente === "object" ? cliente.codigo : cliente;

  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState<any>(null);
  const [pedidosOffline, setPedidosOffline] = useState(0);

  // Estados para Financeiro
  const [titulosVencidos, setTitulosVencidos] = useState<any[]>([]);
  const [titulosAVencer, setTitulosAVencer] = useState<any[]>([]);
  const [temAtraso, setTemAtraso] = useState(false);

  // --- NOVOS ESTADOS PARA GPS E ATENDIMENTO ---
  const [tipoAtendimento, setTipoAtendimento] = useState("gps");
  const [localizando, setLocalizando] = useState(false);
  const [distanciaOk, setDistanciaOk] = useState(false);
  const [distanciaMetros, setDistanciaMetros] = useState<number | null>(null);

  // --- FUNÇÃO PARA CALCULAR DISTÂNCIA (HAVERSINE) ---
  const calcularDistancia = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) => {
    const R = 6371e3; // Raio da Terra em metros
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // --- LÓGICA DE VERIFICAÇÃO DE GPS ---
  const verificarLocalizacao = async () => {
    if (tipoAtendimento !== "gps") {
      setDistanciaOk(true);
      return;
    }

    setLocalizando(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "GPS Necessário",
          "A permissão de localização é obrigatória para atendimentos presenciais.",
        );
        setDistanciaOk(false);
        setLocalizando(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const latCli = parseFloat(dados?.dados_cadastrais?.latitude);
      const lonCli = parseFloat(dados?.dados_cadastrais?.longitude);

      if (!latCli || !lonCli) {
        Alert.alert(
          "Cadastro Incompleto",
          "Este cliente não possui coordenadas (Lat/Log) cadastradas no Protheus.",
        );
        setDistanciaOk(false);
      } else {
        const dist = calcularDistancia(
          location.coords.latitude,
          location.coords.longitude,
          latCli,
          lonCli,
        );
        setDistanciaMetros(Math.round(dist));

        if (dist <= 100) {
          setDistanciaOk(true);
        } else {
          setDistanciaOk(false);
        }
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Erro GPS", "Não foi possível obter sua localização atual.");
    } finally {
      setLocalizando(false);
    }
  };

  useEffect(() => {
    if (dados) {
      if (tipoAtendimento === "gps") {
        verificarLocalizacao();
      } else {
        setDistanciaOk(true);
        setDistanciaMetros(null);
      }
    }
  }, [tipoAtendimento, dados]);

  // --- FORMATAÇÕES ---
  const formatarMoeda = (valor: any) => {
    if (valor === null || valor === undefined) return "R$ 0,00";
    let limpo = valor;
    if (typeof valor === "string") {
      limpo = valor.replace(/\./g, "").replace(",", ".");
    }
    const num = parseFloat(limpo);
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(isNaN(num) ? 0 : num);
  };

  const formatarCNPJ = (cnpj: string) => {
    if (!cnpj) return "";
    const c = cnpj.replace(/\D/g, "");
    if (c.length <= 11) {
      return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    return c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  };

  useFocusEffect(
    useCallback(() => {
      const checarPedidosOffline = async () => {
        try {
          const salvos = await AsyncStorage.getItem("@pedidos_offline");
          if (salvos) {
            const lista = JSON.parse(salvos);
            const filtrados = lista.filter((p: any) => {
              const pCod =
                typeof p.cliente === "object" ? p.cliente.codigo : p.cliente;
              return pCod === codCli && p.loja === loja;
            });
            setPedidosOffline(filtrados.length);
          } else {
            setPedidosOffline(0);
          }
        } catch (e) {
          console.error("Erro ao ler storage", e);
        }
      };
      checarPedidosOffline();
    }, [codCli, loja]),
  );

  useEffect(() => {
    const carregarDetalhes = async () => {
      try {
        setLoading(true);
        const response = await api.get(
          `/api/getdetalhamentocliente?cliente=${codCli}&loja=${loja}&vendedor=${vendedorId}`,
        );
        const resData = response.data;
        setDados(resData);

        if (resData.financeiro) {
          const hoje = new Date();
          hoje.setHours(0, 0, 0, 0);
          const vencidos: any[] = [];
          const aVencer: any[] = [];

          resData.financeiro.forEach((tit: any) => {
            const partes = tit.vencimento.split("/");
            const dtVenc = new Date(
              parseInt(partes[2]),
              parseInt(partes[1]) - 1,
              parseInt(partes[0]),
            );
            if (dtVenc < hoje) vencidos.push(tit);
            else aVencer.push(tit);
          });

          setTitulosVencidos(vencidos);
          setTitulosAVencer(aVencer);
          setTemAtraso(vencidos.length > 0);
        }
      } catch (error) {
        console.error("Erro ao buscar detalhes:", error);
      } finally {
        setLoading(false);
      }
    };
    carregarDetalhes();
  }, [codCli, loja]);

  if (loading)
    return (
      <ActivityIndicator style={{ flex: 1 }} size="large" color="#005492" />
    );

  return (
    <ScrollView style={styles.container}>
      <Surface style={[styles.header, temAtraso && styles.headerComAtraso]}>
        {temAtraso && (
          <Badge style={styles.badgeAlerta} size={22}>
            CLIENTE EM ATRASO
          </Badge>
        )}
        <Headline style={styles.bold}>{dados?.dados_cadastrais?.nome}</Headline>

        <View style={styles.containerDadosHorizontal}>
          <Text style={styles.textoLinhaUnica}>
            {formatarCNPJ(dados?.dados_cadastrais?.cnpj)}
          </Text>
          <Text style={styles.divisorVertical}> | </Text>
          <Text style={styles.textoLinhaUnica}>
            ({dados?.dados_cadastrais?.ddd}) {dados?.dados_cadastrais?.telefone}
          </Text>
        </View>

        <Text style={styles.cnpjTexto}>{dados?.dados_cadastrais?.email}</Text>
      </Surface>

      <View style={styles.atendimentoContainer}>
        <Text style={styles.labelTitulo}>Tipo de Atendimento:</Text>
        <SegmentedButtons
          value={tipoAtendimento}
          onValueChange={setTipoAtendimento}
          buttons={[
            { value: "gps", label: "GPS", icon: "map-marker" },
            { value: "fone", label: "Fone", icon: "phone" },
            { value: "wpp", label: "Wpp", icon: "whatsapp" },
            { value: "pros", label: "Pros.", icon: "account-plus" },
          ]}
          style={styles.segmented}
        />

        {tipoAtendimento === "gps" && (
          <View style={styles.statusGps}>
            {localizando ? (
              <ActivityIndicator size="small" color="#005492" />
            ) : distanciaOk ? (
              <Text style={{ color: "green", fontWeight: "bold" }}>
                ✓ Localização Validada ({distanciaMetros}m)
              </Text>
            ) : (
              <View style={{ alignItems: "center" }}>
                <Text style={{ color: "#d32f2f", fontWeight: "bold" }}>
                  ✗ Fora do Raio de 100m ({distanciaMetros || "---"}m)
                </Text>
                <Button compact onPress={verificarLocalizacao}>
                  Tentar Novamente
                </Button>
              </View>
            )}
          </View>
        )}

        <Button
          mode="contained"
          icon="cart-plus"
          disabled={!distanciaOk || localizando}
          onPress={() =>
            navigation.navigate("SelecaoTabela", {
              cliente,
              loja,
              vendedorId,
              tipoAtendimento,
              saldoFlex: dados?.saldoFlex || 0,
            })
          }
          style={[
            styles.btnNovoPedido,
            temAtraso && distanciaOk && { backgroundColor: "#d32f2f" },
            (!distanciaOk || localizando) && { backgroundColor: "#ccc" },
          ]}
          labelStyle={styles.labelBotao}
        >
          {temAtraso ? "Novo Pedido (Sujeito a Análise)" : "Novo Pedido"}
        </Button>
      </View>

      <Divider />

      <List.Accordion
        title="Informações Cadastrais"
        left={(props) => <List.Icon {...props} icon="account-details" />}
      >
        <List.Item
          title="Endereço"
          description={dados?.dados_cadastrais?.endereco}
          titleStyle={styles.textoPequeno}
        />
        <Divider />
        <List.Item
          title="Cidade/UF"
          description={`${dados?.dados_cadastrais?.cidade} - ${dados?.dados_cadastrais?.estado}`}
          titleStyle={styles.textoPequeno}
        />
        <Divider />
        <List.Item
          title="Limite de Crédito"
          description={formatarMoeda(dados?.dados_cadastrais?.limite)}
          titleStyle={styles.textoPequeno}
          descriptionStyle={{ color: "green", fontWeight: "bold" }}
        />
      </List.Accordion>

      <Divider />

      <List.Accordion
        title="Títulos em Aberto"
        left={(p) => (
          <List.Icon
            {...p}
            icon="cash-multiple"
            color={temAtraso ? "#d32f2f" : "#005492"}
          />
        )}
      >
        {titulosVencidos.length > 0 && (
          <View style={{ backgroundColor: "#fff5f5" }}>
            <List.Subheader style={{ color: "#d32f2f", fontWeight: "bold" }}>
              Vencidos ({titulosVencidos.length})
            </List.Subheader>
            {titulosVencidos.map((tit: any, i: number) => (
              <List.Item
                key={`venc-${i}`}
                title={`Título: ${tit.titulo} - Parcela: ${tit.parcela}`}
                titleStyle={styles.textoPequeno}
                description={`Vencimento: ${tit.vencimento} - ${formatarMoeda(tit.saldo)}`}
                descriptionStyle={{ color: "#d32f2f", fontWeight: "bold" }}
                left={(p) => (
                  <List.Icon {...p} icon="alert-circle" color="#d32f2f" />
                )}
              />
            ))}
          </View>
        )}

        {titulosAVencer.length > 0 && (
          <View>
            <List.Subheader style={{ color: "#005492", fontWeight: "bold" }}>
              A Vencer ({titulosAVencer.length})
            </List.Subheader>
            {titulosAVencer.map((tit: any, i: number) => (
              <List.Item
                key={`avenc-${i}`}
                title={`Título: ${tit.titulo} - Parcela: ${tit.parcela}`}
                titleStyle={styles.textoPequeno}
                description={`Vencimento: ${tit.vencimento} - ${formatarMoeda(tit.saldo)}`}
                descriptionStyle={{ color: "#2e7d32", fontWeight: "bold" }}
                left={(p) => (
                  <List.Icon {...p} icon="clock-outline" color="#666" />
                )}
              />
            ))}
          </View>
        )}
      </List.Accordion>

      <Divider />

      <List.Accordion
        title="Último Pedido Realizado"
        left={(p) => <List.Icon {...p} icon="cart-outline" />}
      >
        <View style={styles.innerPadding}>
          <Text style={styles.bold}>
            Pedido: {dados?.ultimo_pedido?.numero}
          </Text>
          <Caption>Condição: {dados?.ultimo_pedido?.condicao}</Caption>
          <Divider style={styles.spacingDivider} />
          {dados?.ultimo_pedido?.itens
            ?.slice()
            ?.sort((a: any, b: any) =>
              a.item.localeCompare(b.item, undefined, { numeric: true }),
            )
            ?.map((item: any, i: number) => (
              <List.Item
                key={i}
                title={item.produto}
                titleStyle={styles.codigoProduto}
                description={`${item.desc}\nItem: ${item.item} | Qtd: ${item.qtd} | Unit: ${formatarMoeda(item.valor)}`}
                descriptionNumberOfLines={3}
                descriptionStyle={styles.descricaoProduto}
                left={(p) => <List.Icon {...p} icon="package-variant" />}
              />
            ))}
        </View>
      </List.Accordion>

      <Divider />

      {/* --- SEÇÃO: ÚLTIMA NOTA FISCAL --- */}
      <List.Accordion
        title="Última Nota Fiscal"
        left={(p) => <List.Icon {...p} icon="file-document-outline" />}
      >
        <View style={styles.innerPadding}>
          <Text style={styles.bold}>NF: {dados?.ultima_nf?.numero}</Text>
          <Text style={styles.textoPequeno}>
            Emissão: {dados?.ultima_nf?.emissao} | Total:{" "}
            {formatarMoeda(dados?.ultima_nf?.total)}
          </Text>
          <Divider style={styles.spacingDivider} />
          {dados?.ultima_nf?.itens?.map((item: any, i: number) => (
            <React.Fragment key={i}>
              <List.Item
                title={item.produto}
                titleStyle={styles.codigoProduto}
                description={`${item.desc}\nQtd: ${item.qtd} | Total: ${formatarMoeda(item.valor)}`}
                descriptionNumberOfLines={3}
                descriptionStyle={styles.descricaoProduto}
              />
              {i < dados.ultima_nf.itens.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </View>
      </List.Accordion>

      <Divider />

      <List.Item
        title="Pedidos para Sincronizar"
        titleStyle={{
          color: pedidosOffline > 0 ? "#f57c00" : "#333",
          fontWeight: "bold",
          fontSize: 16,
        }}
        description={
          pedidosOffline > 0
            ? `Existem ${pedidosOffline} pedido(s) aguardando sincronização.`
            : "Nenhum pedido offline para este cliente."
        }
        left={(p) => (
          <List.Icon
            {...p}
            icon="cloud-upload-outline"
            color={pedidosOffline > 0 ? "#f57c00" : "#666"}
          />
        )}
        right={(p) => <List.Icon {...p} icon="chevron-right" color="#666" />}
        onPress={() =>
          navigation.navigate("PedidosOffline", { cliente: codCli, loja: loja })
        }
        style={{ backgroundColor: "#fff" }}
      />
      <Divider />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  headerComAtraso: { borderTopWidth: 4, borderTopColor: "#d32f2f" },
  badgeAlerta: {
    backgroundColor: "#d32f2f",
    color: "#fff",
    fontWeight: "bold",
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  atendimentoContainer: {
    padding: 15,
    backgroundColor: "#fff",
    marginBottom: 10,
    elevation: 2,
  },
  labelTitulo: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#666",
    marginBottom: 10,
  },
  segmented: { marginBottom: 15 },
  statusGps: { alignItems: "center", marginBottom: 15 },
  btnNovoPedido: {
    backgroundColor: "#005492",
    borderRadius: 8,
    paddingVertical: 4,
  },
  header: {
    padding: 20,
    alignItems: "center",
    backgroundColor: "#fff",
    width: "100%",
  },
  containerDadosHorizontal: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "nowrap",
    marginVertical: 5,
  },
  textoLinhaUnica: {
    fontSize: 13,
    color: "#666",
  },
  divisorVertical: {
    fontSize: 13,
    color: "#bbb",
    marginHorizontal: 8,
    fontWeight: "bold",
  },
  cnpjTexto: {
    fontSize: 13,
    color: "#666",
    marginBottom: 5,
  },
  labelBotao: { fontSize: 16, fontWeight: "bold", letterSpacing: 1 },
  bold: { fontWeight: "bold", color: "#333" },
  innerPadding: { paddingHorizontal: 15, paddingVertical: 10 },
  textoPequeno: { fontSize: 13, color: "#555" },
  codigoProduto: { fontSize: 12, fontWeight: "bold", color: "#005492" },
  descricaoProduto: { fontSize: 12, color: "#333", lineHeight: 16 },
  spacingDivider: { marginVertical: 8 },
});

export default DetalhesClienteScreen;
