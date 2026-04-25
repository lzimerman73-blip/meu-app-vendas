import React, { useState } from "react";
import { ScrollView, View, StyleSheet, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { TextInput, Button, SegmentedButtons, Surface, Text } from "react-native-paper";
import { Picker } from '@react-native-picker/picker';
import axios from "axios";
import api from "../api/api"; // Configuração de API base para o Protheus

const CadastroClienteScreen = ({ navigation }: any) => {
    const [loading, setLoading] = useState(false);
    const [salvando, setSalvando] = useState(false);
    const [tipoPessoa, setTipoPessoa] = useState("J");

    // Estados do Formulário
    const [documento, setDocumento] = useState("");
    const [nome, setNome] = useState("");
    const [fantasia, setFantasia] = useState("");
    const [endereco, setEndereco] = useState("");
    const [bairro, setBairro] = useState("");
    const [municipio, setMunicipio] = useState("");
    const [codMunicipio, setCodMunicipio] = useState("");
    const [estado, setEstado] = useState("");
    const [cep, setCep] = useState("");
    const [ddd, setDdd] = useState("");
    const [telefone, setTelefone] = useState("");
    const [insEstadual, setInsEstadual] = useState("");
    const [tipoCliente, setTipoCliente] = useState("F");
    const [email, setEmail] = useState("");

    // --- ESTADO PARA CONTROLE DE ERROS/VALIDAÇÃO ---
    const [erros, setErros] = useState<{ [key: string]: boolean }>({});

    // Função para limpar o erro visual quando o usuário volta a digitar
    const clearError = (field: string) => {
        if (erros[field]) {
            setErros(prev => ({ ...prev, [field]: false }));
        }
    };

    // --- MÁSCARAS ---
    const aplicarMascaraDocumento = (text: string) => {
        clearError("documento");
        let limpo = text.replace(/\D/g, "");
        if (tipoPessoa === "F") {
            if (limpo.length > 11) limpo = limpo.substring(0, 11);
            limpo = limpo.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
        } else {
            if (limpo.length > 14) limpo = limpo.substring(0, 14);
            limpo = limpo.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
        }
        setDocumento(limpo);
    };

    const aplicarMascaraCEP = (text: string) => {
        clearError("cep");
        let limpo = text.replace(/\D/g, "");
        if (limpo.length > 8) limpo = limpo.substring(0, 8);
        limpo = limpo.replace(/^(\d{5})(\d)/, "$1-$2");
        setCep(limpo);
    };

    const aplicarMascaraTelefone = (text: string) => {
        clearError("telefone");
        let limpo = text.replace(/\D/g, "");
        if (limpo.length > 11) limpo = limpo.substring(0, 11);
        limpo = limpo.replace(/^(\d{4,5})(\d{4})/, "$1-$2");
        setTelefone(limpo);
    };

    // --- CONSULTA CNPJ (Nova API: cnpj.ws) ---
    const buscarCNPJ = async () => {
        const cnpjLimpo = documento.replace(/\D/g, "");
        if (cnpjLimpo.length !== 14) {
            Alert.alert("Atenção", "Digite um CNPJ válido com 14 dígitos.");
            return;
        }
        setLoading(true);
        try {
            const response = await axios.get(`https://publica.cnpj.ws/cnpj/${cnpjLimpo}`);
            const dados = response.data;
            const est = dados.estabelecimento;

            setNome(dados.razao_social || "");
            setFantasia(est.nome_fantasia || dados.razao_social || "");

            // Concatena Tipo Logradouro com Logradouro (Ex: "AVENIDA" + " " + "JOSE ILIO VERONEZ")
            const tipoLog = est.tipo_logradouro ? `${est.tipo_logradouro} ` : "";
            setEndereco(`${tipoLog}${est.logradouro || ""}, ${est.numero || "S/N"}`);

            setBairro(est.bairro || "");
            setMunicipio(est.cidade?.nome || "");
            setCodMunicipio(est.cidade?.ibge_id ? String(est.cidade.ibge_id) : "");

            const ufLocal = est.estado?.sigla || "";
            setEstado(ufLocal);
            setEmail(est.email ? est.email.toLowerCase() : "");

            setCep(est.cep ? est.cep.replace(/^(\d{5})(\d)/, "$1-$2") : "");

            if (est.ddd1) setDdd(est.ddd1.replace(/\D/g, ""));
            if (est.telefone1) aplicarMascaraTelefone(est.telefone1.replace(/\D/g, ""));

            // Lógica para capturar Inscrição Estadual (IE ativa do mesmo estado do endereço)
            if (est.inscricoes_estaduais && est.inscricoes_estaduais.length > 0) {
                const ieAtiva = est.inscricoes_estaduais.find(
                    (ie: any) => ie.ativo === true && ie.estado?.sigla === ufLocal
                );
                setInsEstadual(ieAtiva ? ieAtiva.inscricao_estadual : "ISENTO");
            } else {
                setInsEstadual("ISENTO");
            }

            // Limpa todos os alertas visuais de erro pois a API preencheu
            setErros({});
        } catch (error: any) {
            console.error(error);
            if (error.response && error.response.status === 429) {
                Alert.alert("Aviso", "Muitas consultas seguidas. Aguarde 1 minuto e tente novamente.");
            } else {
                Alert.alert("Erro", "CNPJ não encontrado na base de dados.");
            }
        } finally {
            setLoading(false);
        }
    };

    // --- GRAVAÇÃO NO PROTHEUS ---
    const handleSalvar = async () => {
        // Validação de campos obrigatórios (Mantido exatamente como o seu)
        const novosErros: { [key: string]: boolean } = {};

        if (!documento) novosErros.documento = true;
        if (!nome) novosErros.nome = true;
        if (!fantasia) novosErros.fantasia = true;
        if (!insEstadual) novosErros.insEstadual = true;
        if (!cep) novosErros.cep = true;
        if (!endereco) novosErros.endereco = true;
        if (!bairro) novosErros.bairro = true;
        if (!codMunicipio) novosErros.codMunicipio = true;
        if (!municipio) novosErros.municipio = true;
        if (!email) novosErros.email = true;
        if (!estado) novosErros.estado = true;
        if (!ddd) novosErros.ddd = true;
        if (!telefone) novosErros.telefone = true;

        if (Object.keys(novosErros).length > 0) {
            setErros(novosErros);
            Alert.alert("Atenção", "Existem campos obrigatórios não preenchidos. Verifique os campos destacados em vermelho.");
            return;
        }

        const payload = {
            tipoPessoa,
            documento: documento.replace(/\D/g, ""),
            nome: nome.substring(0, 60),
            fantasia: fantasia.substring(0, 20),
            endereco: endereco.substring(0, 80),
            bairro: bairro.substring(0, 40),
            municipio: municipio.substring(0, 60),
            codMunicipio,
            estado,
            cep: cep.replace(/\D/g, ""),
            ddd,
            telefone: telefone.replace(/\D/g, ""),
            insEstadual,
            tipoCliente,
            email
        };

        setSalvando(true);
        try {
            const response = await api.post("/api/incluiclientes", payload);

            // Se o Protheus retornar 200 ou 201, usamos a mensagem de sucesso da API
            if (response.status === 201 || response.status === 200) {
                Alert.alert("Sucesso", response.data.message || "Cliente cadastrado no Protheus com sucesso!");
                navigation.goBack();
            } else {
                Alert.alert("Erro", `Falha ao gravar. Status: ${response.status}`);
            }
        } catch (error: any) {
            console.error(error);

            // --- AJUSTE AQUI ---
            // Agora o catch captura a string detalhada que o AdvPL enviou no JSON de erro 500
            const msgErro = error.response?.data?.message || "Erro de conexão com o servidor Protheus.";

            Alert.alert("Falha na Gravação", msgErro);
        } finally {
            setSalvando(false);
        }
    };

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <ScrollView style={styles.container}>
                <Surface style={styles.surface}>
                    <Text style={styles.label}>Tipo de Pessoa</Text>
                    <SegmentedButtons
                        value={tipoPessoa}
                        onValueChange={(val) => {
                            setTipoPessoa(val);
                            setDocumento("");
                            clearError("documento");
                        }}
                        buttons={[{ value: "F", label: "Física (CPF)" }, { value: "J", label: "Jurídica (CNPJ)" }]}
                        style={styles.marginBottom}
                    />

                    <View style={styles.row}>
                        <TextInput
                            label={tipoPessoa === "J" ? "CNPJ" : "CPF"}
                            mode="outlined"
                            value={documento}
                            onChangeText={aplicarMascaraDocumento}
                            keyboardType="numeric"
                            error={erros.documento}
                            style={{ flex: 1, marginRight: tipoPessoa === "J" ? 10 : 0 }}
                        />
                        {tipoPessoa === "J" && (
                            <Button mode="contained" onPress={buscarCNPJ} loading={loading} disabled={loading || documento.length < 18} style={styles.btnBuscar}>
                                Buscar
                            </Button>
                        )}
                    </View>

                    <TextInput label="Razão Social / Nome" mode="outlined" value={nome} onChangeText={(t) => { setNome(t); clearError("nome"); }} maxLength={60} error={erros.nome} style={styles.input} />
                    <TextInput label="Nome Fantasia" mode="outlined" value={fantasia} onChangeText={(t) => { setFantasia(t); clearError("fantasia"); }} maxLength={20} error={erros.fantasia} style={styles.input} />
                    <TextInput label="Inscrição Estadual" mode="outlined" value={insEstadual} onChangeText={(t) => { setInsEstadual(t); clearError("insEstadual"); }} maxLength={18} error={erros.insEstadual} style={styles.input} />

                    <View style={styles.pickerContainer}>
                        <Text style={styles.pickerLabel}>Tipo de Cliente</Text>
                        <Picker selectedValue={tipoCliente} onValueChange={(v) => setTipoCliente(v)}>
                            <Picker.Item label="F - Consumidor Final" value="F" />
                            <Picker.Item label="L - Produtor Rural" value="L" />
                            <Picker.Item label="R - Revendedor" value="R" />
                            <Picker.Item label="S - Solidário" value="S" />
                            <Picker.Item label="X - Exportação" value="X" />
                        </Picker>
                    </View>

                    <TextInput label="CEP" mode="outlined" value={cep} onChangeText={aplicarMascaraCEP} keyboardType="numeric" maxLength={9} error={erros.cep} style={styles.input} />
                    <TextInput label="Endereço" mode="outlined" value={endereco} onChangeText={(t) => { setEndereco(t); clearError("endereco"); }} maxLength={80} error={erros.endereco} style={styles.input} />
                    <TextInput label="Bairro" mode="outlined" value={bairro} onChangeText={(t) => { setBairro(t); clearError("bairro"); }} maxLength={40} error={erros.bairro} style={styles.input} />

                    <View style={styles.row}>
                        <TextInput label="Cód. Mun." mode="outlined" value={codMunicipio} onChangeText={(t) => { setCodMunicipio(t); clearError("codMunicipio"); }} error={erros.codMunicipio} style={[styles.input, { flex: 1, marginRight: 10 }]} />
                        <TextInput label="Município" mode="outlined" value={municipio} onChangeText={(t) => { setMunicipio(t); clearError("municipio"); }} maxLength={60} error={erros.municipio} style={[styles.input, { flex: 2 }]} />
                    </View>

                    <TextInput label="E-mail" mode="outlined" value={email} onChangeText={(t) => { setEmail(t); clearError("email"); }} maxLength={50} keyboardType="email-address" autoCapitalize="none" error={erros.email} style={styles.input} />

                    <View style={styles.row}>
                        <TextInput label="UF" mode="outlined" value={estado} onChangeText={(t) => { setEstado(t); clearError("estado"); }} maxLength={2} autoCapitalize="characters" error={erros.estado} style={[styles.input, { width: 70, marginRight: 10 }]} />
                        <TextInput label="DDD" mode="outlined" value={ddd} onChangeText={(t) => { setDdd(t); clearError("ddd"); }} keyboardType="numeric" maxLength={3} error={erros.ddd} style={[styles.input, { width: 70, marginRight: 10 }]} />
                        <TextInput label="Telefone" mode="outlined" value={telefone} onChangeText={aplicarMascaraTelefone} keyboardType="numeric" maxLength={15} error={erros.telefone} style={[styles.input, { flex: 1 }]} />
                    </View>

                    <Button
                        mode="contained"
                        onPress={handleSalvar}
                        loading={salvando}
                        disabled={salvando}
                        style={styles.botaoSalvar}
                        labelStyle={{ fontSize: 16, fontWeight: 'bold' }}
                    >
                        {salvando ? "Enviando..." : "Salvar Cadastro"}
                    </Button>
                </Surface>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#f5f5f5" },
    surface: { padding: 16, margin: 10, borderRadius: 8, elevation: 3 },
    label: { fontSize: 14, color: '#666', fontWeight: 'bold', marginBottom: 8 },
    input: { marginBottom: 12, backgroundColor: '#fff' },
    marginBottom: { marginBottom: 15 },
    row: { flexDirection: "row", marginBottom: 12 },
    btnBuscar: { justifyContent: 'center', backgroundColor: '#005492' },
    botaoSalvar: { marginTop: 20, marginBottom: 10, backgroundColor: '#005492', paddingVertical: 6 },
    pickerContainer: { borderWidth: 1, borderColor: '#79747E', borderRadius: 4, marginBottom: 12, backgroundColor: '#fff', paddingTop: 5 },
    pickerLabel: { fontSize: 12, color: '#666', marginLeft: 12, marginTop: -15, backgroundColor: '#fff', alignSelf: 'flex-start', paddingHorizontal: 4 }
});

export default CadastroClienteScreen;