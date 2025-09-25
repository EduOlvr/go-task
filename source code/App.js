import React, { useState, useEffect, useReducer, useCallback, createContext, useContext, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  LayoutAnimation,
  UIManager,
  Platform,
  Alert,
  ActivityIndicator,
  StatusBar,
  useColorScheme,
  useWindowDimensions,
  Keyboard,
  Image,
  Switch,
  Appearance,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView, PanGestureHandler } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import * as Localization from 'expo-localization';

// --- INÍCIO: CONFIGURAÇÃO E HOOKS DO FIREBASE ---
import { auth, firestore } from './firebaseConfig'; // Importa a configuração do Firebase
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification, // Importação para verificação de email
} from 'firebase/auth';
import {
  doc,
  setDoc,
  collection,
  writeBatch,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
// --- FIM: CONFIGURAÇÃO E HOOKS DO FIREBASE ---


if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Constants
const STORAGE_KEY = '@goTaskSemanal:tarefas';
const SETTINGS_KEY = '@goTaskSemanal:settings';
const TUTORIAL_KEY = '@goTaskSemanal:tutorialVisto_v4';
const DragAndDropContext = createContext({});
const defaultColors = ['#0b2e63ff', '#4a90e2', '#28a745', '#d9534f', '#6f42c1', '#ffffff', '#000000'];
const APP_VERSION = 'Go Task v1.8.0';

// Tarefa de exemplo para o tutorial
const tutorialTask = {
    id: 'tutorial-task-id',
    texto: 'Esta é uma tarefa de exemplo!',
    date: new Date().toISOString(),
    concluida: false,
    importante: true,
    fixada: false,
    color: '#4a90e2',
    fontWeight: 'bold',
    createdAt: new Date().toISOString(),
};

// --- INÍCIO: CONTEXTO DE AUTENTICAÇÃO E TELAS ---
const AuthContext = createContext();

const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const value = {
        user,
        loading,
        login: (email, password) => signInWithEmailAndPassword(auth, email, password),
        register: (email, password) => createUserWithEmailAndPassword(auth, email, password),
        logout: () => signOut(auth),
        resetPassword: (email) => sendPasswordResetEmail(auth, email),
        verifyEmail: (currentUser) => sendEmailVerification(currentUser),
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

const useAuth = () => {
    return useContext(AuthContext);
};

// TELA DE AUTENTICAÇÃO (LOGIN, REGISTRO, ETC.)
const AuthScreen = ({ onContinueOffline, isDarkMode }) => {
    const [mode, setMode] = useState('welcome'); // 'welcome', 'login', 'register', 'reset'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState({ email: false, password: false });
    const styles = useStyles(isDarkMode);
    const { login, register, resetPassword, verifyEmail } = useAuth();

    const validateEmail = (email) => {
        const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(String(email).toLowerCase());
    };

    const validatePassword = (password) => {
        const hasMinLength = password.length >= 6;
        const hasLetter = /[a-zA-Z]/.test(password);
        const hasNumber = /\d/.test(password);
        return hasMinLength && hasLetter && hasNumber;
    };
    
    const getFirebaseErrorMessage = (e) => {
        switch (e.code) {
            case 'auth/invalid-email':
                return 'O formato do email é inválido.';
            case 'auth/user-not-found':
                return 'Nenhum usuário encontrado com este email.';
            case 'auth/wrong-password':
                return 'Senha incorreta. Tente novamente.';
            case 'auth/email-already-in-use':
                return 'Este email já está sendo usado por outra conta.';
            case 'auth/weak-password':
                return 'A senha é muito fraca. Tente uma mais forte.';
            default:
                return 'Ocorreu um erro. Verifique suas credenciais.';
        }
    }

    const clearErrors = () => {
        setError('');
        setFieldErrors({ email: false, password: false });
    };

    const handleLogin = async () => {
        clearErrors();
        if (!email || !password) {
            setError('Por favor, preencha todos os campos.');
            setFieldErrors({ email: !email, password: !password });
            return;
        }
        if (!validateEmail(email)) {
            setError('Por favor, insira um email válido.');
            setFieldErrors({ email: true, password: false });
            return;
        }
        setLoading(true);
        try {
            await login(email, password);
        } catch (e) {
            setError(getFirebaseErrorMessage(e));
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async () => {
        clearErrors();
        if (!email || !password) {
            setError('Por favor, preencha todos os campos.');
            setFieldErrors({ email: !email, password: !password });
            return;
        }
        if (!validateEmail(email)) {
            setError('Por favor, insira um email válido.');
            setFieldErrors({ email: true, password: false });
            return;
        }
        if (!validatePassword(password)) {
            setError('A senha deve ter no mínimo 6 caracteres, com pelo menos uma letra e um número.');
            setFieldErrors({ email: false, password: true });
            return;
        }
        setLoading(true);
        try {
            const userCredential = await register(email, password);
            await verifyEmail(userCredential.user);
            Alert.alert(
                'Registro Concluído!',
                'Enviamos um email de verificação. Por favor, verifique sua caixa de entrada para ativar sua conta.'
            );
            // O onAuthStateChanged cuidará da navegação
        } catch (e) {
            setError(getFirebaseErrorMessage(e));
        } finally {
            setLoading(false);
        }
    };
    
    const handleResetPassword = async () => {
        clearErrors();
        if (!email) {
            setError('Por favor, digite seu email.');
            setFieldErrors({ email: true, password: false });
            return;
        }
        if (!validateEmail(email)) {
            setError('Por favor, insira um email válido.');
            setFieldErrors({ email: true, password: false });
            return;
        }
        setLoading(true);
        try {
            await resetPassword(email);
            Alert.alert('Verifique seu Email', 'Um link para redefinir sua senha foi enviado para seu email.');
            setMode('login');
        } catch(e) {
            setError(getFirebaseErrorMessage(e));
        } finally {
            setLoading(false);
        }
    };

    const renderForm = () => {
        const isLogin = mode === 'login';
        const isRegister = mode === 'register';
        const isReset = mode === 'reset';

        return (
            <View style={styles.authFormContainer}>
                <TouchableOpacity onPress={() => { clearErrors(); setMode('welcome'); }} style={styles.authBackButton}>
                    <Ionicons name="arrow-back" size={24} color={styles.iconColor.color} />
                </TouchableOpacity>
                <Text style={styles.authTitle}>{isLogin ? 'Entrar' : isRegister ? 'Registrar' : 'Redefinir Senha'}</Text>
                <Text style={styles.authSubtitle}>
                    {isLogin ? 'Bem-vindo de volta!' : isRegister ? 'Crie uma conta para salvar suas tarefas na nuvem.' : 'Digite seu email para receber o link de redefinição.'}
                </Text>

                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Email *</Text>
                    <TextInput
                        style={[styles.authInput, fieldErrors.email && styles.authInputError]}
                        placeholder="seu@email.com"
                        value={email}
                        onChangeText={(text) => { setEmail(text); clearErrors(); }}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        placeholderTextColor={styles.placeholderColor.color}
                    />
                </View>

                {!isReset && (
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Senha *</Text>
                        <TextInput
                            style={[styles.authInput, fieldErrors.password && styles.authInputError]}
                            placeholder="Mínimo 6 caracteres"
                            value={password}
                            onChangeText={(text) => { setPassword(text); clearErrors(); }}
                            secureTextEntry
                            placeholderTextColor={styles.placeholderColor.color}
                        />
                        {isRegister && (
                             <Text style={styles.passwordHint}>Deve conter letras e números.</Text>
                        )}
                    </View>
                )}

                {error ? <Text style={styles.authErrorText}>{error}</Text> : null}
                
                <TouchableOpacity style={styles.authButton} onPress={isLogin ? handleLogin : isRegister ? handleRegister : handleResetPassword} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.authButtonText}>{isLogin ? 'Entrar' : isRegister ? 'Registrar' : 'Enviar Email'}</Text>}
                </TouchableOpacity>

                {isLogin && (
                    <TouchableOpacity onPress={() => { clearErrors(); setMode('reset'); }}>
                        <Text style={styles.authLinkText}>Esqueceu a senha?</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    if (mode === 'login' || mode === 'register' || mode === 'reset') {
        return <SafeAreaView style={styles.safeArea}>{renderForm()}</SafeAreaView>;
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.welcomeContainer}>
                <Image source={require('./assets/go.png')} style={styles.welcomeLogo} />
                <Text style={styles.welcomeTitle}>Bem-vindo ao Go Task</Text>
                <Text style={styles.welcomeSubtitle}>Obtenha o controle da semana de forma eficiente.</Text>

                <TouchableOpacity style={styles.authButton} onPress={() => { clearErrors(); setMode('login'); }}>
                    <Text style={styles.authButtonText}>Entrar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.authButton, styles.authButtonSecondary]} onPress={() => { clearErrors(); setMode('register'); }}>
                    <Text style={[styles.authButtonText, styles.authButtonTextSecondary]}>Registrar</Text>
                </TouchableOpacity>

                <View style={styles.welcomeDivider}>
                    <View style={styles.welcomeDividerLine} />
                    <Text style={styles.welcomeDividerText}>OU</Text>
                    <View style={styles.welcomeDividerLine} />
                </View>

                <TouchableOpacity onPress={onContinueOffline}>
                    <Text style={styles.authLinkText}>Continuar offline</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};
// --- FIM: CONTEXTO DE AUTENTICAÇÃO E TELAS ---


// Textos em diferentes idiomas
const translations = {
  pt: {
    appName: 'Go Task',
    addTask: 'Adicionar tarefa...',
    editTask: 'Editar Tarefa',
    exampleTask: 'Esta é uma tarefa de exemplo!',
    noTasks: 'Nenhuma tarefa',
    deleteTask: 'Excluir Tarefa',
    confirmDelete: 'Tem certeza?',
    cancel: 'Cancelar',
    delete: 'Excluir',
    copy: 'Copiado!',
    copyText: 'O texto da tarefa foi copiado para a área de transferência.',
    invalidDate: 'Data Inválida',
    pastDateError: 'Não é possível adicionar tarefas em datas anteriores à semana atual.',
    selected: 'selecionada',
    selectedPlural: 'selecionadas',
    futureTasks: 'Tarefas Futuras',
    appearance: 'Aparência',
    darkTheme: 'Tema Escuro',
    systemTheme: 'Usar tema do sistema',
    fontSize: 'Tamanho da Fonte',
    buttonSize: 'Tamanho dos Botões',
    about: 'Sobre',
    github: 'Ver no GitHub',
    support: 'Apoie o desenvolvedor',
    version: APP_VERSION,
    developedBy: 'Desenvolvido com ❤️ por Eduardo Oliveira',
    color: 'Cor:',
    formatting: 'Formatação:',
    highlightColor: 'Cor de destaque:',
    save: 'Salvar',
    monday: 'Segunda',
    tuesday: 'Terça',
    wednesday: 'Quarta',
    thursday: 'Quinta',
    friday: 'Sexta',
    saturday: 'Sábado',
    sunday: 'Domingo',
    markAll: 'Marcar',
    unmarkAll: 'Desmarcar',
    pdfError: 'Erro',
    pdfErrorMsg: 'Não foi possível gerar o PDF.',
    tutorialSteps: [
      'Bem-vindo ao Go Task!\nVamos fazer um tour rápido pelas principais funcionalidades do app.',
      'Primeiro, adicione uma nova tarefa na caixa de texto. Você pode formatá-la usando as opções abaixo.',
      'Para não perder uma tarefa importante, fixe-a clicando no alfinete. Veja como:',
      'IMPORTANTE: Tarefas de semanas passadas são limpas automaticamente. As tarefas fixadas (com alfinete) NUNCA são apagadas!',
      'Para mover uma tarefa, simplesmente arraste-a para outro dia, como no exemplo:',
      'Para apagar várias tarefas de uma vez, pressione e segure uma delas para ativar o modo de seleção.',
      'Por fim, acesse o menu para configurar temas, fontes e outras opções.',
      'Tudo pronto! Você já sabe tudo o que precisa para organizar sua semana. Boa sorte!'
    ],
    previous: 'Anterior',
    skip: 'Pular',
    next: 'Próximo',
    finish: 'Finalizar',
    draftRestored: 'Rascunho restaurado!',
    autoSave: 'Salvamento automático',
    autoSaveMsg: 'Suas alterações estão sendo salvas automaticamente.',
    // Novas traduções para autenticação
    logout: 'Sair',
    logoutConfirm: 'Deseja realmente sair? Suas tarefas não salvas na nuvem podem ser perdidas.',
    syncing: 'Sincronizando dados...',
    loginOrCreateAccount: 'Fazer Login ou Criar Conta',
  },
  en: {
    appName: 'Go Task',
    addTask: 'Add task...',
    editTask: 'Edit Task',
    exampleTask: 'This is an example task!',
    noTasks: 'No tasks',
    deleteTask: 'Delete Task',
    confirmDelete: 'Are you sure?',
    cancel: 'Cancel',
    delete: 'Delete',
    copy: 'Copied!',
    copyText: 'Task text has been copied to clipboard.',
    invalidDate: 'Invalid Date',
    pastDateError: 'Cannot add tasks to dates before the current week.',
    selected: 'selected',
    selectedPlural: 'selected',
    futureTasks: 'Future Tasks',
    appearance: 'Appearance',
    darkTheme: 'Dark Theme',
    systemTheme: 'Use system theme',
    fontSize: 'Font Size',
    buttonSize: 'Button Size',
    about: 'About',
    github: 'View on GitHub',
    support: 'Support the developer',
    version: APP_VERSION,
    developedBy: 'Developed with ❤️ by Eduardo Oliveira',
    color: 'Color:',
    formatting: 'Formatting:',
    highlightColor: 'Highlight color:',
    save: 'Save',
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday',
    markAll: 'Mark',
    unmarkAll: 'Unmark',
    pdfError: 'Error',
    pdfErrorMsg: 'Could not generate PDF.',
    tutorialSteps: [
      'Welcome to Go Task!\nLet\'s take a quick tour of the app\'s main features.',
      'First, add a new task in the text box. You can format it using the options below.',
      'To keep important tasks from being lost, pin them by clicking the pin icon. See how:',
      'IMPORTANT: Tasks from past weeks are automatically cleaned up. Pinned tasks (with a pin) are NEVER deleted!',
      'To move a task, simply drag it to another day, as in the example:',
      'To delete multiple tasks at once, press and hold one of them to activate selection mode.',
      'Finally, access the menu to configure themes, fonts and other options.',
      'All set! You now know everything you need to organize your week. Good luck!'
    ],
    previous: 'Previous',
    skip: 'Skip',
    next: 'Next',
    finish: 'Finish',
    draftRestored: 'Draft restored!',
    autoSave: 'Autosave',
    autoSaveMsg: 'Your changes are being saved automatically.',
    // New translations for auth
    logout: 'Logout',
    logoutConfirm: 'Are you sure you want to log out? Your unsynced tasks might be lost.',
    syncing: 'Syncing data...',
    loginOrCreateAccount: 'Login or Create Account',
  }
};

// Helper functions
const getSemanaAtual = (language = 'pt') => {
  const hoje = new Date();
  const diaDaSemana = hoje.getDay();
  // Ajuste para semana começar na Segunda-feira (Monday)
  const diff = hoje.getDate() - diaDaSemana + (diaDaSemana === 0 ? -6 : 1);
  const inicioDaSemana = new Date(hoje.setDate(diff));
  inicioDaSemana.setHours(0, 0, 0, 0);

  const dayNames = language === 'pt' ?
    ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'] :
    ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
  return dayNames.map((nome, index) => {
    const data = new Date(inicioDaSemana);
    data.setDate(inicioDaSemana.getDate() + index);
    const dateObj = new Date(data.getFullYear(), data.getMonth(), data.getDate());
    
    return {
      nome,
      data: dateObj.toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      shortDate: dateObj.toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US', { day: '2-digit', month: '2-digit' }),
      dateObj: dateObj,
      displayKey: nome,
    };
  });
};

const dateShort = (d, language = 'pt') => d.toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US', { day: '2-digit', month: '2-digit' });
const weekDayNameFromDate = (d, language = 'pt') => {
  const weekday = d.toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US', { weekday: 'short' });
  return language === 'pt' ? weekday.replace('.', '') : weekday;
};

// Reducer for state management
const initialState = {
  tarefas: [],
  isLoading: true,
  settings: {
    theme: 'system',
    fontSize: 14,
    showPreview: true,
    buttonSize: 'small',
    language: 'pt',
    autoSave: true,
  }
};

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_TAREFAS':
      return { ...state, tarefas: action.payload };
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };
    case 'SET_SETTINGS':
        return { ...state, settings: action.payload ? { ...initialState.settings, ...action.payload } : initialState.settings };
    case 'ADD_TAREFA':
        if (state.tarefas.some(t => t.id === action.payload.id)) {
            return state;
        }
        return { ...state, tarefas: [...state.tarefas, action.payload] };
    case 'UPDATE_TAREFA':
      return {
        ...state,
        tarefas: state.tarefas.map(t =>
          t.id === action.payload.id ? { ...t, ...action.payload.updates } : t
        )
      };
    case 'DELETE_TAREFAS':
        return {
            ...state,
            tarefas: state.tarefas.filter(t => !action.payload.includes(t.id))
        };
    case 'TOGGLE_PIN_TAREFA':
        return {
            ...state,
            tarefas: state.tarefas.map(t =>
                t.id === action.payload ? { ...t, fixada: !t.fixada } : t
            )
        };
    default:
      return state;
  }
}

// --- INÍCIO DA SEÇÃO DE COMPONENTES ---

const TutorialModal = ({ visible, onFinish, layouts, language = 'pt' }) => {
    const [step, setStep] = useState(0);
    const insets = useSafeAreaInsets();
    const t = translations[language] || translations.pt;

    const tutorialSteps = t.tutorialSteps.map((text, index) => ({
        text,
        targetKey: index === 0 ? null : 
                     index === 1 ? 'inputArea' : 
                     index === 6 ? 'settingsButton' : 'taskList',
        gif: index === 2 ? require('./assets/tutorial/gif01.gif') : 
             index === 4 ? require('./assets/tutorial/gif02.gif') : 
             index === 5 ? require('./assets/tutorial/gif03.gif') : null
    }));

    const currentStepData = tutorialSteps[step];
    const layout = layouts[currentStepData.targetKey] || null;

    let highlightStyle = null;
    if (layout) {
        highlightStyle = {
            position: 'absolute',
            top: layout.pageY - 3,
            left: layout.pageX - 3,
            width: layout.width + 6,
            height: layout.height + 6,
            borderRadius: 8,
        };
    }

    const handleNext = () => (step < tutorialSteps.length - 1) ? setStep(step + 1) : onFinish();
    const handlePrev = () => (step > 0) && setStep(step - 1);

    return (
        <Modal animationType="fade" transparent visible={visible} onRequestClose={onFinish}>
            <View style={tutorialStyles.overlay}>
                {highlightStyle && <View style={[tutorialStyles.highlight, highlightStyle]} />}
                <View style={[tutorialStyles.textBox, { bottom: insets.bottom + 20 }]}>
                    <Text style={tutorialStyles.text}>{currentStepData.text}</Text>
                    
                    {currentStepData.gif && (
                        <View style={tutorialStyles.gifContainer}>
                            <Image source={currentStepData.gif} style={tutorialStyles.gif} />
                        </View>
                    )}

                    <View style={tutorialStyles.navigation}>
                        {step > 0 ? (
                            <TouchableOpacity onPress={handlePrev} style={[tutorialStyles.button, tutorialStyles.prevButton]}>
                                <Text style={tutorialStyles.buttonText}>{t.previous}</Text>
                            </TouchableOpacity>
                        ) : <View style={{ flex: 1 }}/>}
                        <TouchableOpacity onPress={onFinish} style={[tutorialStyles.button, tutorialStyles.skipButton]}>
                            <Text style={tutorialStyles.buttonText}>{t.skip}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleNext} style={[tutorialStyles.button, tutorialStyles.nextButton]}>
                            <Text style={tutorialStyles.buttonText}>
                                {step === tutorialSteps.length - 1 ? t.finish : t.next}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const tutorialStyles = StyleSheet.create({
    overlay: { 
        flex: 1, 
        backgroundColor: 'rgba(0, 0, 0, 0.8)' 
    },
    highlight: {
        backgroundColor: 'transparent',
        borderColor: '#4a90e2', 
        borderWidth: 3, 
        borderRadius: 10,
        borderStyle: 'dashed',
    },
    textBox: {
        position: 'absolute', 
        left: 20, 
        right: 20,
        backgroundColor: '#2c2c2c', 
        borderRadius: 15, 
        padding: 20,
        borderWidth: 1, 
        borderColor: '#555'
    },
    text: { 
        color: '#fff', 
        fontSize: 16, 
        textAlign: 'center', 
        marginBottom: 15, 
        lineHeight: 22 
    },
    gifContainer: {
        borderRadius: 8, 
        overflow: 'hidden',
        marginBottom: 15, 
        borderWidth: 1, 
        borderColor: '#555',
        alignSelf: 'stretch',
        height: 180,
    },
    gif: { 
        width: '100%', 
        height: '100%', 
        resizeMode: 'contain' 
    },
    navigation: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        width: '100%' 
    },
    button: { 
        paddingVertical: 10, 
        paddingHorizontal: 15, 
        borderRadius: 8, 
        flex: 1, 
        marginHorizontal: 5, 
        alignItems: 'center' 
    },
    nextButton: { 
        backgroundColor: '#4a90e2' 
    },
    prevButton: { 
        backgroundColor: '#555' 
    },
    skipButton: { 
        backgroundColor: 'transparent' 
    },
    buttonText: { 
        color: '#fff', 
        fontWeight: 'bold' 
    },
});

const ColorPicker = React.memo(({ selectedColor, onColorSelect, isDarkMode, language = 'pt' }) => {
    const styles = useStyles(isDarkMode);
    const t = translations[language] || translations.pt;
  
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 8, flexWrap: 'wrap' }}>
        <Text style={[styles.label, { marginRight: 12 }]}>{t.color}</Text>
        {defaultColors.map(color => (
          <TouchableOpacity
            key={color}
            onPress={() => onColorSelect(color)}
            style={[
              styles.colorOption,
              { backgroundColor: color },
              selectedColor === color && styles.colorOptionSelected,
              color === '#ffffff' && { borderWidth: 1, borderColor: isDarkMode ? '#ccc' : '#333' }
            ]}
          />
        ))}
      </View>
    );
});

const FormatOptions = React.memo(({ fontStyle, fontWeight, highlight, onFormatChange, isDarkMode, buttonSize, language = 'pt' }) => {
    const styles = useStyles(isDarkMode);
    const t = translations[language] || translations.pt;
    const buttonStyle = getButtonSizeStyle(buttonSize);
  
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 8 }}>
        <Text style={[styles.label, { marginRight: 12 }]}>{t.formatting}</Text>
        <TouchableOpacity
          onPress={() => onFormatChange('fontStyle', fontStyle === 'italic' ? null : 'italic')}
          style={[ styles.formatButton, buttonStyle, fontStyle === 'italic' && styles.formatButtonActive ]} >
          <Text style={{ fontStyle: 'italic', fontWeight: 'bold', color: styles.iconColor.color, fontSize: buttonStyle.fontSize }}>I</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={() => onFormatChange('fontWeight', fontWeight === 'bold' ? null : 'bold')}
          style={[ styles.formatButton, buttonStyle, fontWeight === 'bold' && styles.formatButtonActive, { marginLeft: 8 } ]} >
          <Text style={{ fontWeight: 'bold', color: styles.iconColor.color, fontSize: buttonStyle.fontSize }}>B</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={() => onFormatChange('highlight', !highlight)}
          style={[ styles.formatButton, buttonStyle, highlight && styles.formatButtonActive, { marginLeft: 8 } ]} >
          <Ionicons name="color-fill-outline" size={buttonStyle.iconSize} color={styles.iconColor.color} />
        </TouchableOpacity>
      </View>
    );
});
  
const PreviewCard = React.memo(({ text, color, fontStyle, fontWeight, highlight, highlightColor, isDarkMode, fontSize }) => {
    const styles = useStyles(isDarkMode, fontSize);
    
    if (!text) return null;
    
    return (
      <View style={[styles.previewContainer, highlight && { backgroundColor: highlightColor }]}>
        <View style={styles.previewContent}>
          <Ionicons name="square-outline" size={22} color={color} style={{ marginRight: 10 }} />
          <Text style={[ styles.previewText, {  color, fontStyle: fontStyle || 'normal', fontWeight: fontWeight || 'normal', flexShrink: 1, } ]}>
            {text}
          </Text>
        </View>
      </View>
    );
});

const EditModal = React.memo(({ 
    visible, 
    onClose, 
    textoEditado, 
    setTextoEditado,
    dataEditada,
    setDataEditada,
    chosenColor, 
    setChosenColor,
    fontStyleChoice,
    setFontStyleChoice,
    fontWeightChoice,
    setFontWeightChoice,
    highlight,
    setHighlight,
    highlightColor,
    setHighlightColor,
    onSave,
    isDarkMode,
    fontSize,
    buttonSize,
    language = 'pt',
    autoSaveEnabled,
    onAutoSave
  }) => {
    const styles = useStyles(isDarkMode, fontSize);
    const { height } = useWindowDimensions();
    const [datePickerVisible, setDatePickerVisible] = useState(false);
    const [lastSaveTime, setLastSaveTime] = useState(null);
    const [debouncedText, setDebouncedText] = useState(textoEditado);
    const t = translations[language] || translations.pt;
    
    const autoSaveTimerRef = useRef(null);
    
    useEffect(() => {
      if (autoSaveEnabled && textoEditado && textoEditado.trim() !== '') {
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
        }
        
        autoSaveTimerRef.current = setTimeout(() => {
          if (onAutoSave) {
            onAutoSave();
            setLastSaveTime(new Date());
          }
        }, 2000); 
      }
      
      return () => {
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
        }
      };
    }, [textoEditado, autoSaveEnabled, onAutoSave]);
    
    useEffect(() => {
      const handler = setTimeout(() => {
        setDebouncedText(textoEditado);
      }, 300); 
  
      return () => {
        clearTimeout(handler);
      };
    }, [textoEditado]);
  
    const handleFormatChange = (type, value) => {
      if (type === 'fontStyle') setFontStyleChoice(value);
      if (type === 'fontWeight') setFontWeightChoice(value);
      if (type === 'highlight') setHighlight(value);
    };
  
    const handleClose = () => {
      Keyboard.dismiss();
      setTimeout(() => { onClose(); }, 100);
    };
  
    const handleSave = () => {
      Keyboard.dismiss();
      setTimeout(() => { onSave(); }, 100);
    };
  
    return (
      <Modal 
        animationType="fade" 
        transparent 
        visible={visible} 
        onRequestClose={handleClose}
        statusBarTranslucent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={[ 
            styles.modalContent, 
            { maxHeight: height * 0.9 },
          ]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t.editTask}</Text>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                  {autoSaveEnabled && lastSaveTime && (
                    <Text style={[styles.autoSaveIndicator, {marginRight: 10}]}>
                      {t.autoSave}
                    </Text>
                  )}
                  <TouchableOpacity onPress={() => setDatePickerVisible(true)} style={styles.closeButton}>
                      <Ionicons name="calendar" size={24} color={styles.iconColor.color} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                      <Ionicons name="close" size={24} color={styles.iconColor.color} />
                  </TouchableOpacity>
              </View>
            </View>
            
            <ScrollView 
              style={styles.modalScrollView}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
            >
              {datePickerVisible && (
                <DateTimePicker
                  value={dataEditada}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => {
                      setDatePickerVisible(false);
                      if (selectedDate) {
                          setDataEditada(selectedDate);
                      }
                  }}
                />
              )}
              <TextInput
                style={styles.modalInput}
                value={textoEditado}
                onChangeText={setTextoEditado}
                multiline
                autoFocus={false}
                placeholder={t.addTask}
                placeholderTextColor={styles.placeholderColor.color}
                textBreakStrategy="highQuality"
                allowFontScaling={true}
              />
              
              <ColorPicker selectedColor={chosenColor} onColorSelect={setChosenColor} isDarkMode={isDarkMode} language={language} />
              
              <FormatOptions
                fontStyle={fontStyleChoice}
                fontWeight={fontWeightChoice}
                highlight={highlight}
                onFormatChange={handleFormatChange}
                isDarkMode={isDarkMode}
                buttonSize={buttonSize}
                language={language}
              />
              
              {highlight && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 8 }}>
                  <Text style={[styles.label, { marginRight: 12 }]}>{t.highlightColor}</Text>
                  <TouchableOpacity
                    onPress={() => setHighlightColor('#fff8c6')}
                    style={[styles.highlightOption, { backgroundColor: '#fff8c6' }, highlightColor === '#fff8c6' && styles.highlightOptionSelected]}
                  />
                  <TouchableOpacity
                    onPress={() => setHighlightColor('#ffcccc')}
                    style={[styles.highlightOption, { backgroundColor: '#ffcccc', marginLeft: 8 }, highlightColor === '#ffcccc' && styles.highlightOptionSelected]}
                  />
                  <TouchableOpacity
                    onPress={() => setHighlightColor('#0c5218ff')}
                    style={[styles.highlightOption, { backgroundColor: '#0c5218ff', marginLeft: 8 }, highlightColor === '#0c5218ff' && styles.highlightOptionSelected]}
                  />
                </View>
              )}
  
              <PreviewCard
                text={debouncedText || t.exampleTask}
                color={chosenColor}
                fontStyle={fontStyleChoice}
                fontWeight={fontWeightChoice}
                highlight={highlight}
                highlightColor={highlightColor}
                isDarkMode={isDarkMode}
                fontSize={fontSize}
              />
            </ScrollView>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonCancel]} onPress={handleClose}>
                <Text style={styles.modalButtonText}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonSave]} onPress={handleSave}>
                <Text style={styles.modalButtonText}>{t.save}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
});
  
const DraggableTarefaItem = React.memo(({ tarefa, diaKey, onToggleConcluida, onToggleImportancia, onDelete, onEdit, onDuplicate, onCopyText, onToggleFixada, isDarkMode, fontSize, buttonSize, language = 'pt' }) => {
    const styles = useStyles(isDarkMode, fontSize);
    const { multiSelectMode, selectedTasks, toggleTaskSelection, setDraggedItem, handleDragEnd, isDragging, onDragActive } = useContext(DragAndDropContext);
    const t = translations[language] || translations.pt;
  
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const isSelected = selectedTasks.includes(tarefa.id);
    const buttonStyle = getButtonSizeStyle(buttonSize);
  
    const gestureHandler = useAnimatedGestureHandler({
      onStart: () => { 
        runOnJS(setDraggedItem)({ tarefa, diaDeOrigem: diaKey }); 
      },
      onActive: (event) => {
        translateX.value = event.translationX;
        translateY.value = event.translationY;
        runOnJS(onDragActive)(event.absoluteX, event.absoluteY);
      },
      onEnd: () => {
        runOnJS(handleDragEnd)();
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      },
    });
  
    const animatedStyle = useAnimatedStyle(() => {
      const isBeingDragged = isDragging && isDragging.tarefa && isDragging.tarefa.id === tarefa.id;
      return {
        transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
        zIndex: isBeingDragged ? 999 : 0,
        elevation: isBeingDragged ? 999 : 0,
        opacity: withTiming(isBeingDragged ? 0.85 : 1),
        backgroundColor: tarefa.highlight ? (tarefa.highlightColor || '#fff8c6') : styles.animatedTaskBackground.color,
      };
    });
  
    const textStyle = [
      styles.tarefaTexto,
      styles.textWithOutline,
      tarefa.concluida && styles.tarefaConcluida,
      {
        fontStyle: tarefa.fontStyle || 'normal',
        fontWeight: tarefa.fontWeight || 'normal',
        color: tarefa.color || (isDarkMode ? '#ffffff' : '#000000'),
        flexShrink: 1,
      }
    ];
  
    return (
      <PanGestureHandler onGestureEvent={gestureHandler} enabled={!multiSelectMode}>
        <Animated.View style={animatedStyle}>
          <TouchableOpacity
            onLongPress={() => toggleTaskSelection(tarefa.id)}
            onPress={() => (multiSelectMode ? toggleTaskSelection(tarefa.id) : onToggleConcluida())}
            style={[styles.tarefaItemContainer, multiSelectMode && isSelected && styles.tarefaSelecionada]}
            activeOpacity={0.7}
          >
            <View style={styles.tarefaPrincipal}>
              {multiSelectMode ? (
                <Ionicons 
                  name={isSelected ? 'checkmark-circle' : 'ellipse-outline'} 
                  size={22} 
                  color={isSelected ? '#4a90e2' : styles.iconColor.color} 
                  style={styles.tarefaCheckboxIcon} 
                />
              ) : (
                <Ionicons 
                  name={tarefa.concluida ? 'checkbox' : 'square-outline'} 
                  size={22} 
                  color={tarefa.concluida ? '#4a90e2' : styles.iconColor.color} 
                  style={styles.tarefaCheckboxIcon} 
                />
              )}
              <Text 
                  style={textStyle} 
                  numberOfLines={3}
                  textBreakStrategy="highQuality"
                  allowFontScaling={true}
                  adjustsFontSizeToFit={false}>
                  {tarefa.texto}
              </Text>
            </View>
  
            {!multiSelectMode && (
              <View style={styles.tarefaAcoes}>
                <TouchableOpacity onPress={onToggleFixada} style={[styles.botaoAcao, buttonStyle]}>
                  <Ionicons name={tarefa.fixada ? 'pin' : 'pin-outline'} size={buttonStyle.iconSize} color={tarefa.fixada ? '#ff8c00' : styles.iconColor.color} />
                </TouchableOpacity>
                <TouchableOpacity onPress={onToggleImportancia} style={[styles.botaoAcao, buttonStyle]}>
                  <Ionicons name={tarefa.importante ? 'star' : 'star-outline'} size={buttonStyle.iconSize} color={tarefa.importante ? '#FFD700' : styles.iconColor.color} />
                </TouchableOpacity>
                <TouchableOpacity onPress={onDuplicate} style={[styles.botaoAcao, buttonStyle]}>
                  <Ionicons name="copy-outline" size={buttonStyle.iconSize} color={styles.iconColor.color} />
                </TouchableOpacity>
                <TouchableOpacity onPress={onCopyText} style={[styles.botaoAcao, buttonStyle]}>
                  <Ionicons name="clipboard-outline" size={buttonStyle.iconSize} color={styles.iconColor.color} />
                </TouchableOpacity>
                <TouchableOpacity onPress={onEdit} style={[styles.botaoAcao, buttonStyle]}>
                  <Ionicons name="pencil-outline" size={buttonStyle.iconSize} color={styles.iconColor.color} />
                </TouchableOpacity>
                <TouchableOpacity onPress={onDelete} style={[styles.botaoAcao, buttonStyle]}>
                  <Ionicons name="trash-outline" size={buttonStyle.iconSize} color="#d9534f" />
                </TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      </PanGestureHandler>
    );
});
  
const DiaDaSemana = React.memo(({ diaInfo, tarefasList, onUpdateTarefa, onDeleteTarefa, onDuplicateTarefa, onToggleFixadaTarefa, multiSelectMode, selectedTasks, onToggleSelectAllForDay, isDarkMode, fontSize, buttonSize, forwardedRef, language = 'pt' }) => {
    const styles = useStyles(isDarkMode, fontSize);
    const [expandido, setExpandido] = useState(true);
    const { setDayLayout, hoveredDay } = useContext(DragAndDropContext);
    const t = translations[language] || translations.pt;
  
    const isHovered = hoveredDay === diaInfo.displayKey;
  
    const allTaskIdsForThisDay = tarefasList.map(t => t.id);
    const selectedTasksForThisDay = allTaskIdsForThisDay.filter(id => selectedTasks.includes(id));
    const areAllSelectedForThisDay = allTaskIdsForThisDay.length > 0 && selectedTasksForThisDay.length === allTaskIdsForThisDay.length;
  
    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: withSpring(isHovered ? 1.01 : 1) }],
      borderColor: withTiming(isHovered ? '#4a90e2' : 'transparent'),
      borderWidth: 1.2,
    }));
  
    const handleToggleExpandido = useCallback(() => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setExpandido(!expandido);
    }, [expandido]);
      
  const gerarPdfParaDia = async () => {
    const tarefasHtml = tarefasList
      .sort((a, b) => b.importante - a.importante)
      .map(tarefa => {
        const textDecoration = tarefa.concluida ? 'line-through' : 'none';
        const fontStyle = tarefa.fontStyle || 'normal';
        const fontWeight = tarefa.fontWeight || 'normal';
        const color = isDarkMode ? '#eee' : (tarefa.color || '#000');
        const backgroundColor = tarefa.highlight ? tarefa.highlightColor || '#fff8c6' : 'transparent';
        
        return `
          <div style="
            padding: 12px; 
            margin-bottom: 8px; 
            background-color: ${backgroundColor}; 
            border-radius: 6px; 
            border-left: 4px solid ${tarefa.importante ? '#FFD700' : '#4a90e2'};
            word-wrap: break-word;
            overflow-wrap: break-word;
          ">
            <span style="
              text-decoration: ${textDecoration}; 
              font-style: ${fontStyle}; 
              font-weight: ${fontWeight}; 
              color: ${color}; 
              font-size: 16px;
              line-height: 1.5;
            ">
              ${tarefa.texto.replace(/\n/g, '<br/>')}
            </span>
            ${tarefa.fixada ? '📌' : ''}
          </div>`;
    }).join('');
  
    const htmlContent = `
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              background-color: ${isDarkMode ? '#121212' : '#fff'}; 
              color: ${isDarkMode ? '#fff' : '#000'}; 
              padding: 30px;
              max-width: 100%;
              word-wrap: break-word;
            }
            .header { 
              text-align: center; 
              margin-bottom: 30px;
              border-bottom: 3px solid #4a90e2;
              padding-bottom: 15px;
            }
            h1 { 
              color: #4a90e2; 
              font-size: 28px;
              margin: 0;
              font-weight: bold;
            }
            h2 {
              color: ${isDarkMode ? '#ccc' : '#555'};
              font-size: 20px;
              margin: 15px 0;
              font-weight: 600;
            }
            .app-info {
              text-align: center;
              margin-top: 30px;
              font-size: 14px;
              color: ${isDarkMode ? '#888' : '#666'};
              border-top: 1px solid ${isDarkMode ? '#333' : '#ddd'};
              padding-top: 15px;
            }
            @media print {
              body { 
                padding: 15px;
                background-color: white !important;
                color: black !important;
              }
              .header {
                border-bottom: 3px solid #000;
              }
              h1 { color: #000; }
              h2 { color: #333; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Go Task</h1>
            <h2>${language === 'pt' ? 'Tarefas para' : 'Tasks for'}: ${diaInfo.headerTitle} ${diaInfo.shortDate ? `(${diaInfo.shortDate})` : ''}</h2>
          </div>
          <div>
            ${tarefasHtml || `<p style="text-align: center; color: #888; font-style: italic;">${language === 'pt' ? 'Nenhuma tarefa para este dia' : 'No tasks for this day'}.</p>`}
          </div>
          <div class="app-info">
            ${APP_VERSION} - ${new Date().toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </div>
        </body>
      </html>
    `;
  
    try {
      const { uri } = await Print.printToFileAsync({ 
        html: htmlContent,
        width: 595, 
        height: 842,
        margins: {
          top: 36,
          bottom: 36,
          left: 36,
          right: 36
        }
      });
      
      await Sharing.shareAsync(uri, { 
        mimeType: 'application/pdf', 
        dialogTitle: language === 'pt' ? 'Compartilhar Tarefas' : 'Share Tasks',
        UTI: 'com.adobe.pdf'
      });
    } catch (error) {
      Alert.alert(t.pdfError, t.pdfErrorMsg);
    }
  };
    return (
      <Animated.View 
        ref={forwardedRef}
        style={[styles.diaContainer, animatedStyle]} 
        onLayout={(e) => setDayLayout(diaInfo.displayKey, e.nativeEvent.layout)}>
        <View style={styles.diaHeader}>
          <TouchableOpacity onPress={handleToggleExpandido} style={styles.diaHeaderTitle}>
            <Text style={styles.diaTexto}>
              {diaInfo.headerTitle}
              {diaInfo.shortDate ? ( <Text style={styles.diaDataTexto}> ({diaInfo.shortDate})</Text> ) : null}
            </Text>
            <Ionicons name={expandido ? 'chevron-up-outline' : 'chevron-down-outline'} size={18} color={styles.iconColor.color} style={{ marginLeft: 8 }} />
          </TouchableOpacity>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
              {multiSelectMode && tarefasList.length > 0 && (
                  <TouchableOpacity onPress={() => onToggleSelectAllForDay(allTaskIdsForThisDay, areAllSelectedForThisDay)} style={styles.selectAllDayButton}>
                      <Text style={styles.selectAllDayButtonText}>
                          {areAllSelectedForThisDay ? t.unmarkAll : t.markAll}
                      </Text>
                  </TouchableOpacity>
              )}
              <TouchableOpacity onPress={gerarPdfParaDia} style={{ padding: 4 }}>
                  <Ionicons name="print-outline" size={20} color={styles.iconColor.color} />
              </TouchableOpacity>
          </View>
        </View>
  
        {expandido && (
          <View>
            {tarefasList.sort((a, b) => b.importante - a.importante).map((item) => (
              <DraggableTarefaItem
                key={item.id}
                tarefa={item}
                diaKey={diaInfo.displayKey}
                onToggleConcluida={() => onUpdateTarefa(item.id, { concluida: !item.concluida })}
                onToggleImportancia={() => onUpdateTarefa(item.id, { importante: !item.importante })}
                onDelete={() => onDeleteTarefa(item.id)}
                onDuplicate={() => onDuplicateTarefa(item)}
                onToggleFixada={() => onToggleFixadaTarefa(item.id)}
                onCopyText={() => {
                  Clipboard.setStringAsync(item.texto);
                  Alert.alert(t.copy, t.copyText);
                }}
                onEdit={() => onUpdateTarefa(item.id, { editando: true })}
                isDarkMode={isDarkMode}
                fontSize={fontSize}
                buttonSize={buttonSize}
                language={language}
              />
            ))}
            {tarefasList.length === 0 && (
              <Text style={styles.emptyStateText}>{t.noTasks}</Text>
            )}
          </View>
        )}
      </Animated.View>
    );
});

const SettingsModal = React.memo(
  ({
    visible,
    onClose,
    settings,
    onSettingsChange,
    isDarkMode,
    language = 'pt',
    isLoggedIn,
    onLogout,
    onGoToLogin, // Nova prop
  }) => {
    const styles = useStyles(isDarkMode, settings.fontSize);
    const t = translations[language] || translations.pt;
    const insets = useSafeAreaInsets();

    const handleThemeChange = (value) => {
      onSettingsChange({ theme: value ? 'dark' : 'light' });
    };

    const handleSystemTheme = (value) => {
      if (value) {
        onSettingsChange({ theme: 'system' });
      } else {
        const currentSystemTheme = Appearance.getColorScheme();
        onSettingsChange({ theme: currentSystemTheme || 'light' });
      }
    };

    const handleLanguageChange = () => {
      const newLanguage = language === 'pt' ? 'en' : 'pt';
      onSettingsChange({ language: newLanguage });
    };

    const handleAutoSaveChange = (value) => {
      onSettingsChange({ autoSave: value });
    };

    const handleLogout = () => {
        Alert.alert(
            t.logout,
            t.logoutConfirm,
            [
                { text: t.cancel, style: 'cancel' },
                { text: t.logout, style: 'destructive', onPress: onLogout }
            ]
        );
    };

    return (
      <Modal
        animationType="slide"
        transparent={false}
        visible={visible}
        onRequestClose={onClose}
        statusBarTranslucent={true}
      >
        <SafeAreaView
          style={{ flex: 1, backgroundColor: isDarkMode ? '#1e1e1e' : '#fff' }}
        >
          <View style={styles.settingsContainer}>
            <View style={[styles.settingsHeader, { paddingTop: insets.top }]}>
              <Text style={styles.settingsTitle}>{t.appName}</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons
                  name="close"
                  size={28}
                  color={styles.iconColor.color}
                />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.settingsContent}>
              <Text style={styles.settingsSectionTitle}>Conta</Text>
              {isLoggedIn ? (
                  <TouchableOpacity
                      style={[styles.settingsItemWide, { backgroundColor: isDarkMode ? '#331c1b' : '#fff4f3' }]}
                      onPress={handleLogout}
                  >
                      <Ionicons name="log-out-outline" size={24} color={'#d9534f'} />
                      <Text style={[styles.settingsItemText, { color: '#d9534f', fontWeight: 'bold' }]}>
                          {t.logout}
                      </Text>
                  </TouchableOpacity>
              ) : (
                  <TouchableOpacity
                      style={[styles.settingsItemWide, { backgroundColor: isDarkMode ? '#1c2e4a' : '#e8f4ff' }]}
                      onPress={onGoToLogin}
                  >
                      <Ionicons name="log-in-outline" size={24} color={'#4a90e2'} />
                      <Text style={[styles.settingsItemText, { color: '#4a90e2', fontWeight: 'bold' }]}>
                          {t.loginOrCreateAccount}
                      </Text>
                  </TouchableOpacity>
              )}


              <Text style={styles.settingsSectionTitle}>{t.appearance}</Text>

              <View style={styles.settingsItem}>
                <View style={styles.settingsItemContent}>
                  <Ionicons
                    name="moon-outline"
                    size={24}
                    color={styles.iconColor.color}
                  />
                  <Text style={styles.settingsItemText}>{t.darkTheme}</Text>
                </View>
                <Switch
                  disabled={settings.theme === 'system'}
                  value={settings.theme === 'dark'}
                  onValueChange={handleThemeChange}
                  trackColor={{ false: '#767577', true: '#81b0ff' }}
                  thumbColor={'#f4f3f4'}
                />
              </View>

              <View style={styles.settingsItem}>
                <View style={styles.settingsItemContent}>
                  <Ionicons
                    name="contrast-outline"
                    size={24}
                    color={styles.iconColor.color}
                  />
                  <Text style={styles.settingsItemText}>{t.systemTheme}</Text>
                </View>
                <Switch
                  value={settings.theme === 'system'}
                  onValueChange={handleSystemTheme}
                />
              </View>

              <View style={styles.settingsItem}>
                <View style={styles.settingsItemContent}>
                  <Ionicons
                    name="language-outline"
                    size={24}
                    color={styles.iconColor.color}
                  />
                  <Text style={styles.settingsItemText}>
                    {language === 'pt' ? 'Português' : 'English'}
                  </Text>
                </View>
                <Switch
                  value={language === 'en'}
                  onValueChange={handleLanguageChange}
                />
              </View>

              <View style={styles.settingsItem}>
                <View style={styles.settingsItemContent}>
                  <Ionicons
                    name="save-outline"
                    size={24}
                    color={styles.iconColor.color}
                  />
                  <Text style={styles.settingsItemText}>{t.autoSave}</Text>
                </View>
                <Switch
                  value={settings.autoSave}
                  onValueChange={handleAutoSaveChange}
                />
              </View>

              <View style={styles.settingsItemRow}>
                <Ionicons
                  name="text-outline"
                  size={24}
                  color={styles.iconColor.color}
                />
                <Text style={styles.settingsItemText}>{t.fontSize}</Text>
              </View>
              <View style={styles.fontSizeSelector}>
                <TouchableOpacity
                  onPress={() => onSettingsChange({ fontSize: 12 })}
                  style={[
                    styles.fontSizeButton,
                    settings.fontSize === 12 && styles.fontSizeButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.fontSizeButtonText,
                      settings.fontSize === 12 &&
                        styles.fontSizeButtonTextActive,
                    ]}
                  >
                    P
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onSettingsChange({ fontSize: 14 })}
                  style={[
                    styles.fontSizeButton,
                    settings.fontSize === 14 && styles.fontSizeButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.fontSizeButtonText,
                      settings.fontSize === 14 &&
                        styles.fontSizeButtonTextActive,
                    ]}
                  >
                    M
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onSettingsChange({ fontSize: 16 })}
                  style={[
                    styles.fontSizeButton,
                    settings.fontSize === 16 && styles.fontSizeButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.fontSizeButtonText,
                      settings.fontSize === 16 &&
                        styles.fontSizeButtonTextActive,
                    ]}
                  >
                    G
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.settingsItemRow}>
                <Ionicons
                  name="resize-outline"
                  size={24}
                  color={styles.iconColor.color}
                />
                <Text style={styles.settingsItemText}>{t.buttonSize}</Text>
              </View>
              <View style={styles.fontSizeSelector}>
                <TouchableOpacity
                  onPress={() => onSettingsChange({ buttonSize: 'small' })}
                  style={[
                    styles.fontSizeButton,
                    settings.buttonSize === 'small' &&
                      styles.fontSizeButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.fontSizeButtonText,
                      settings.buttonSize === 'small' &&
                        styles.fontSizeButtonTextActive,
                    ]}
                  >
                    P
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onSettingsChange({ buttonSize: 'medium' })}
                  style={[
                    styles.fontSizeButton,
                    settings.buttonSize === 'medium' &&
                      styles.fontSizeButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.fontSizeButtonText,
                      settings.buttonSize === 'medium' &&
                        styles.fontSizeButtonTextActive,
                    ]}
                  >
                    M
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onSettingsChange({ buttonSize: 'large' })}
                  style={[
                    styles.fontSizeButton,
                    settings.buttonSize === 'large' &&
                      styles.fontSizeButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.fontSizeButtonText,
                      settings.buttonSize === 'large' &&
                        styles.fontSizeButtonTextActive,
                    ]}
                  >
                    G
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.settingsSectionTitle}>{t.about}</Text>

              <TouchableOpacity
                style={styles.settingsItemWide}
                onPress={() =>
                  Linking.openURL('https://github.com/EduOlvr/go-task')
                }
              >
                <Ionicons
                  name="logo-github"
                  size={24}
                  color={styles.iconColor.color}
                />
                <Text style={styles.settingsItemText}>{t.github}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.settingsItemWide}
                onPress={() =>
                  Linking.openURL('https://buymeacoffee.com/eduardooliveira')
                }
              >
                <Ionicons name="heart-outline" size={24} color={'#d9534f'} />
                <Text
                  style={[styles.settingsItemText, { color: '#d9534f' }]}
                >
                  {t.support}
                </Text>
              </TouchableOpacity>
            </ScrollView>

            <View
              style={[
                styles.aboutSection,
                { paddingBottom: insets.bottom > 0 ? insets.bottom : 16 },
              ]}
            >
              <Text style={styles.aboutText}>{t.version}</Text>
              <Text style={styles.aboutText}>{t.developedBy}</Text>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }
);


// Helper function para tamanho dos botões
const getButtonSizeStyle = (size) => {
    switch (size) {
      case 'small':
        return { padding: 6, fontSize: 14, iconSize: 16 };
      case 'large':
        return { padding: 10, fontSize: 18, iconSize: 22 };
      case 'medium':
      default:
        return { padding: 8, fontSize: 16, iconSize: 20 };
    }
};

// --- FIM DA SEÇÃO DE COMPONENTES ---

function App() {
  return (
    <AuthProvider>
        <SafeAreaProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <AppContentController />
          </GestureHandlerRootView>
        </SafeAreaProvider>
    </AuthProvider>
  );
}

function AppContentController() {
    const { user, loading } = useAuth();
    const [isOfflineMode, setIsOfflineMode] = useState(false);
    const systemColorScheme = useColorScheme();

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: systemColorScheme === 'dark' ? '#121212' : '#f7f7f7' }}>
                <ActivityIndicator size="large" color="#4a90e2" />
            </View>
        );
    }

    if (user || isOfflineMode) {
        return <AppContent key={user ? user.uid : 'offline'} user={user} onSwitchToAuth={() => setIsOfflineMode(false)} />;
    }

    return <AuthScreen onContinueOffline={() => setIsOfflineMode(true)} isDarkMode={systemColorScheme === 'dark'}/>;
}

function AppContent({ user, onSwitchToAuth }) {
  const { logout } = useAuth();
  const [state, dispatch] = useReducer(appReducer, initialState);
  const { tarefas, isLoading, settings } = state;
  const insets = useSafeAreaInsets();
  
  const systemColorScheme = useColorScheme();
  const isDarkMode = settings.theme === 'system' ? systemColorScheme === 'dark' : settings.theme === 'dark';
  const styles = useStyles(isDarkMode, settings.fontSize, insets);
  const language = settings.language || 'pt';
  const t = translations[language] || translations.pt;

  const [diasDaSemana, setDiasDaSemana] = useState(() => getSemanaAtual(language));
  const [tarefaInput, setTarefaInput] = useState('');
  const [modalVisivel, setModalVisivel] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [tarefaSendoEditada, setTarefaSendoEditada] = useState(null);
  const [textoEditado, setTextoEditado] = useState('');
  const [dataEditada, setDataEditada] = useState(new Date());
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [draggedItem, setDraggedItem] = useState(null);
  const [dayLayouts, setDayLayouts] = useState({});
  const [hoveredDay, setHoveredDay] = useState(null);
  const [scrollViewLayout, setScrollViewLayout] = useState(null);
  const scrollY = useSharedValue(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialLayouts, setTutorialLayouts] = useState({});
  const [tutorialReady, setTutorialReady] = useState(false);
  const inputAreaRef = useRef(null);
  const formatToolbarRef = useRef(null);
  const taskListRef = useRef(null);
  const settingsButtonRef = useRef(null);
  
    // --- LÓGICA DE DADOS (FIREBASE E ASYNCSTORAGE) ---

    const saveTasksToFirestore = async (tasksToSave) => {
        if (!user) return;
        try {
            const tasksCollection = collection(firestore, 'users', user.uid, 'tasks');
            const batch = writeBatch(firestore);
            
            const querySnapshot = await getDocs(tasksCollection);
            querySnapshot.forEach(doc => {
                if (!tasksToSave.some(t => t.id === doc.id)) {
                    batch.delete(doc.ref);
                }
            });

            tasksToSave.forEach(task => {
                const taskRef = doc(tasksCollection, task.id);
                const taskForFirestore = {
                    ...task,
                    date: Timestamp.fromDate(new Date(task.date)),
                    createdAt: Timestamp.fromDate(new Date(task.createdAt)),
                };
                batch.set(taskRef, taskForFirestore);
            });
    
            await batch.commit();
        } catch (error) {
            // Silently fail for now, maybe show a small toast later
        }
    };
    
    useEffect(() => {
        const initApp = async () => {
            dispatch({ type: 'SET_LOADING', payload: true });
            
            const savedSettings = await AsyncStorage.getItem(SETTINGS_KEY);
            let currentLanguage = 'pt';
            if (savedSettings) {
                const parsedSettings = JSON.parse(savedSettings);
                dispatch({ type: 'SET_SETTINGS', payload: parsedSettings });
                currentLanguage = parsedSettings.language || 'pt';
            } else {
                const deviceLanguage = Localization.getLocales()[0]?.languageCode;
                const initialLanguage = deviceLanguage === 'en' ? 'en' : 'pt';
                dispatch({ type: 'SET_SETTINGS', payload: { ...initialState.settings, language: initialLanguage } });
                currentLanguage = initialLanguage;
            }
            setDiasDaSemana(getSemanaAtual(currentLanguage));

            if (user) {
                setIsSyncing(true);
                const localData = await AsyncStorage.getItem(STORAGE_KEY);
                const localTasks = localData ? JSON.parse(localData) : [];
                
                const tasksCollection = collection(firestore, 'users', user.uid, 'tasks');
                const querySnapshot = await getDocs(tasksCollection);
                const remoteTasks = querySnapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        ...data,
                        id: doc.id,
                        date: data.date.toDate().toISOString(),
                        createdAt: data.createdAt.toDate().toISOString(),
                    };
                });

                const tasksMap = new Map();
                remoteTasks.forEach(task => tasksMap.set(task.id, task));
                localTasks.forEach(task => tasksMap.set(task.id, task));
                const mergedTasks = Array.from(tasksMap.values());
                
                dispatch({ type: 'SET_TAREFAS', payload: mergedTasks });
                await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(mergedTasks));
                await saveTasksToFirestore(mergedTasks);

                setIsSyncing(false);

            } else {
                const dadosSalvos = await AsyncStorage.getItem(STORAGE_KEY);
                if (dadosSalvos) {
                    const tarefasSalvas = JSON.parse(dadosSalvos);
                    const inicioDaSemanaAtual = getSemanaAtual(currentLanguage)[0].dateObj;
                    const tarefasFiltradas = tarefasSalvas.filter(t => {
                        const taskDate = new Date(t.date);
                        taskDate.setHours(0, 0, 0, 0);
                        return t.fixada || taskDate >= inicioDaSemanaAtual;
                    });
                    dispatch({ type: 'SET_TAREFAS', payload: tarefasFiltradas });
                }
            }
            
            const hasSeenTutorial = await AsyncStorage.getItem(TUTORIAL_KEY);
            if (!hasSeenTutorial) {
                dispatch({ type: 'ADD_TAREFA', payload: tutorialTask });
                setShowTutorial(true);
            }

            dispatch({ type: 'SET_LOADING', payload: false });
        };
    
        initApp();
    }, [user]);


    useEffect(() => {
        const saveData = async () => {
            if (!isLoading) {
                const tasksToSave = tarefas.filter(t => t.id !== tutorialTask.id);
                await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tasksToSave));
                await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
                
                if (user) {
                    await saveTasksToFirestore(tasksToSave);
                }
            }
        };
        saveData();
    }, [tarefas, settings, isLoading, user]);

  useEffect(() => {
  if (showTutorial) {
    // Dê tempo para a UI renderizar completamente
    const timer = setTimeout(() => {
      const refs = { 
        inputArea: inputAreaRef, 
        formatToolbar: formatToolbarRef, 
        taskList: taskListRef, 
        settingsButton: settingsButtonRef 
      };
      const layouts = {};
      let measuredCount = 0;
      const refEntries = Object.entries(refs).filter(([, ref]) => ref && ref.current);
      
      if (refEntries.length === 0) {
        setTutorialLayouts({});
        setTutorialReady(true);
        return;
      }

      refEntries.forEach(([key, ref]) => {
        if (ref.current && ref.current.measureInWindow) {
          ref.current.measureInWindow((x, y, width, height) => {
            layouts[key] = { 
              pageX: x, 
              pageY: y, 
              width, 
              height 
            };
            measuredCount++;
            
            if (measuredCount === refEntries.length) {
              setTutorialLayouts(layouts);
              setTutorialReady(true);
            }
          });
        } else {
          measuredCount++;
          if (measuredCount === refEntries.length) {
            setTutorialLayouts(layouts);
            setTutorialReady(true);
          }
        }
      });
    }, 800); // Aumente o timeout para garantir renderização

    return () => clearTimeout(timer);
  }
}, [showTutorial]);

  useEffect(() => {
    setDiasDaSemana(getSemanaAtual(language));
  }, [language]);

  const handleFinishTutorial = async () => {
      try {
          await AsyncStorage.setItem(TUTORIAL_KEY, 'true');
      } catch (e) {
        // Error saving data
      } finally {
          dispatch({ type: 'DELETE_TAREFAS', payload: [tutorialTask.id] });
          setShowTutorial(false);
      }
  };

  const [editingOptions, setEditingOptions] = useState({
    chosenColor: isDarkMode ? '#ffffff' : '#000000',
    fontStyleChoice: null,
    fontWeightChoice: null,
    highlight: false,
    highlightColor: '#fff8c6'
  });

  const [pickerDate, setPickerDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const handleLogoutPress = async () => {
    await logout();
    await AsyncStorage.removeItem(STORAGE_KEY);
    dispatch({ type: 'SET_TAREFAS', payload: [] });
  };

  const prepararEdicaoTarefa = useCallback((tarefa) => {
    if (tarefa.id === tutorialTask.id) return;
    setEditingOptions({
      chosenColor: tarefa.color || (isDarkMode ? '#ffffff' : '#000000'),
      fontStyleChoice: tarefa.fontStyle || null,
      fontWeightChoice: tarefa.fontWeight || null,
      highlight: !!tarefa.highlight,
      highlightColor: tarefa.highlightColor || '#fff8c6'
    });
    setTextoEditado(tarefa.texto);
    setDataEditada(new Date(tarefa.date));
    setTarefaSendoEditada(tarefa);
    
    setTimeout(() => { setModalVisivel(true); }, 50);
  }, [isDarkMode]);
  
  const handleUpdateTarefa = useCallback((tarefaId, updates) => {
    if (updates.editando) {
        const tarefaParaEditar = tarefas.find(t => t.id === tarefaId);
        if (tarefaParaEditar) {
            prepararEdicaoTarefa(tarefaParaEditar);
        }
    } else {
        dispatch({ type: 'UPDATE_TAREFA', payload: { id: tarefaId, updates }});
    }
  }, [tarefas, prepararEdicaoTarefa]);
  
  const handleDeleteTarefa = useCallback((tarefaId) => {
      if (tarefaId === tutorialTask.id) return;
      Alert.alert(t.deleteTask, t.confirmDelete, [
          { text: t.cancel, style: 'cancel' },
          { text: t.delete, style: 'destructive', onPress: () => dispatch({ type: 'DELETE_TAREFAS', payload: [tarefaId] }) }
      ]);
  }, [t]);

  const handleDuplicateTarefa = useCallback((tarefa) => {
      if (tarefa.id === tutorialTask.id) return;
      const novaTarefa = { 
          ...tarefa, 
          id: Date.now().toString() + '-copy', 
          concluida: false, 
          createdAt: new Date().toISOString() 
      };
      dispatch({ type: 'ADD_TAREFA', payload: novaTarefa });
  }, []);

  const handleToggleFixadaTarefa = useCallback((tarefaId) => {
      dispatch({ type: 'TOGGLE_PIN_TAREFA', payload: tarefaId });
  }, []);

  const adicionarTarefa = useCallback(() => {
    if (tarefaInput.trim() === '') return;
    
    if (diasDaSemana.length > 0) {
        const inicioDaSemana = diasDaSemana[0].dateObj;
        const dataSelecionada = new Date(pickerDate);
        dataSelecionada.setHours(0, 0, 0, 0);

        if (dataSelecionada < inicioDaSemana) {
            Alert.alert(t.invalidDate, t.pastDateError);
            return;
        }
    }

    const novaTarefa = {
      id: Date.now().toString(),
      texto: tarefaInput,
      date: pickerDate.toISOString(),
      concluida: false,
      importante: false,
      fixada: false,
      color: editingOptions.chosenColor,
      fontStyle: editingOptions.fontStyleChoice,
      fontWeight: editingOptions.fontWeightChoice,
      highlight: editingOptions.highlight,
      highlightColor: editingOptions.highlightColor,
      createdAt: new Date().toISOString(),
    };

    dispatch({ type: 'ADD_TAREFA', payload: novaTarefa });
    setTarefaInput('');
    setEditingOptions({
      chosenColor: isDarkMode ? '#ffffff' : '#000000',
      fontStyleChoice: null,
      fontWeightChoice: null,
      highlight: false,
      highlightColor: '#fff8c6'
    });
    
  }, [tarefaInput, pickerDate, diasDaSemana, editingOptions, t, isDarkMode]);

  const salvarEdicao = useCallback(() => {
    if (!tarefaSendoEditada) return;

    if (diasDaSemana.length > 0) {
        const inicioDaSemana = diasDaSemana[0].dateObj;
        const novaData = new Date(dataEditada);
        novaData.setHours(0, 0, 0, 0);

        if (novaData < inicioDaSemana) {
            Alert.alert(t.invalidDate, t.pastDateError);
            return;
        }
    }
    
    const updates = {
      texto: textoEditado,
      date: dataEditada.toISOString(),
      color: editingOptions.chosenColor,
      fontStyle: editingOptions.fontStyleChoice,
      fontWeight: editingOptions.fontWeightChoice,
      highlight: editingOptions.highlight,
      highlightColor: editingOptions.highlightColor,
    };
    dispatch({ type: 'UPDATE_TAREFA', payload: { id: tarefaSendoEditada.id, updates } });
    
    setModalVisivel(false);
    setTarefaSendoEditada(null);
    setTextoEditado('');
  }, [tarefaSendoEditada, textoEditado, dataEditada, editingOptions, diasDaSemana, t]);

  const handleAutoSave = useCallback(() => {
    if (tarefaSendoEditada && textoEditado && textoEditado.trim() !== '') {
      const updates = {
        texto: textoEditado,
        date: dataEditada.toISOString(),
        color: editingOptions.chosenColor,
        fontStyle: editingOptions.fontStyleChoice,
        fontWeight: editingOptions.fontWeightChoice,
        highlight: editingOptions.highlight,
        highlightColor: editingOptions.highlightColor,
      };
      dispatch({ type: 'UPDATE_TAREFA', payload: { id: tarefaSendoEditada.id, updates } });
    }
  }, [tarefaSendoEditada, textoEditado, dataEditada, editingOptions]);

  const toggleTaskSelection = useCallback((id) => {
    const newSelected = selectedTasks.includes(id) 
      ? selectedTasks.filter(tid => tid !== id) 
      : [...selectedTasks, id];
    
    setSelectedTasks(newSelected);
    if (newSelected.length === 0) {
        setMultiSelectMode(false);
    } else {
        setMultiSelectMode(true);
    }
  }, [selectedTasks]);

  const deleteSelectedTasks = useCallback(() => {
    Alert.alert(t.deleteTask, `${t.confirmDelete} ${selectedTasks.length} ${selectedTasks.length === 1 ? t.selected : t.selectedPlural}?`, [
        { text: t.cancel, style: 'cancel' },
        { 
          text: t.delete, 
          style: 'destructive',
          onPress: () => {
            dispatch({ type: 'DELETE_TAREFAS', payload: selectedTasks });
            cancelMultiSelect();
          }
        }
      ]
    );
  }, [selectedTasks, t]);

  const cancelMultiSelect = useCallback(() => {
    setMultiSelectMode(false);
    setSelectedTasks([]);
  }, []);
  const handleToggleSelectAllForDay = useCallback((taskIdsForDay, areAllSelected) => {
    if (areAllSelected) {
        setSelectedTasks(prev => prev.filter(id => !taskIdsForDay.includes(id)));
    } else {
        setSelectedTasks(prev => [...new Set([...prev, ...taskIdsForDay])]);
    }
  }, []);

  const handleDragEnd = useCallback(() => {
    try {
      if (draggedItem && hoveredDay && hoveredDay !== draggedItem.diaDeOrigem) {
        const { tarefa } = draggedItem;
        
        const diaMatch = diasDaSemana.find(d => d.displayKey === hoveredDay);
        let novaData;
  
        if (diaMatch) {
            novaData = diaMatch.dateObj;
        } else {
            const dateParts = hoveredDay.split('/');
            if (language === 'pt') { // DD/MM/YYYY
                novaData = new Date(dateParts[2], dateParts[1] - 1, dateParts[0]);
            } else { // MM/DD/YYYY
                novaData = new Date(dateParts[2], dateParts[0] - 1, dateParts[1]);
            }
        }
        
        dispatch({
            type: 'UPDATE_TAREFA',
            payload: {
                id: tarefa.id,
                updates: { date: novaData.toISOString() }
            }
        });
      }
    } catch (error) {
        // Silently catch error
    } finally {
      setDraggedItem(null);
      setHoveredDay(null);
    }
  }, [draggedItem, hoveredDay, diasDaSemana, language]);
  
  const handleSettingsChange = (newSettings) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: newSettings });
  };
  
  const onDragActive = useCallback((absoluteX, absoluteY) => {
    if (!scrollViewLayout) return;
    let currentHoveredDay = null;
    for (const dia in dayLayouts) {
      const dayLayout = dayLayouts[dia];
      const dayTop = dayLayout.y - scrollY.value + scrollViewLayout.y;
      const dayBottom = dayTop + dayLayout.height;
      
      if (absoluteY > dayTop && absoluteY < dayBottom) {
        currentHoveredDay = dia;
        break;
      }
    }
    setHoveredDay(currentHoveredDay);
  }, [scrollViewLayout, dayLayouts, scrollY]);

  const tarefasAgrupadas = useMemo(() => {
    const groups = {};
    diasDaSemana.forEach(dia => {
        groups[dia.displayKey] = [];
    });
 
    tarefas.forEach(tarefa => {
        const tarefaDate = new Date(tarefa.date);
        tarefaDate.setHours(0,0,0,0);
 
        const diaDaSemanaMatch = diasDaSemana.find(d => d.dateObj.getTime() === tarefaDate.getTime());
        
        let key;
        if (diaDaSemanaMatch) {
            key = diaDaSemanaMatch.displayKey;
        } else {
            key = tarefaDate.toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }
        
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(tarefa);
    });
    return groups;
  }, [tarefas, diasDaSemana, language]);

  const buildDisplay = useCallback(() => {
    const result = [...diasDaSemana.map(d => ({...d, type: 'weekday'}))];
 
    const futureTasks = tarefas
        .filter(t => {
            const tarefaDate = new Date(t.date);
            tarefaDate.setHours(0,0,0,0);
            return !diasDaSemana.some(d => d.dateObj.getTime() === tarefaDate.getTime());
        })
        .sort((a,b) => new Date(a.date) - new Date(b.date));
 
    const futureKeys = [...new Set(futureTasks.map(t => new Date(t.date).toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric' })))];
    
    if (futureKeys.length > 0) {
      result.push({ type: 'separator', title: t.futureTasks });
      futureKeys.forEach(key => {
          result.push({ type: 'future_day', displayKey: key });
      });
    }
    
    return result;
  }, [tarefas, diasDaSemana, language, t]);

  const displayStructure = buildDisplay();

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4a90e2" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <DragAndDropContext.Provider value={{
      multiSelectMode,
      selectedTasks,
      toggleTaskSelection,
      isDragging: draggedItem,
      setDraggedItem,
      dayLayouts,
      setDayLayout: (dia, layout) => setDayLayouts(prev => ({ ...prev, [dia]: layout })),
      handleDragEnd,
      onDragActive,
      hoveredDay
    }}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar 
            barStyle={isDarkMode ? 'light-content' : 'dark-content'} 
            backgroundColor={isDarkMode ? '#121212' : '#f7f7f7'} 
        />
        <View style={styles.container}>
          <EditModal
            visible={modalVisivel}
            onClose={() => setModalVisivel(false)}
            textoEditado={textoEditado}
            setTextoEditado={setTextoEditado}
            dataEditada={dataEditada}
            setDataEditada={setDataEditada}
            chosenColor={editingOptions.chosenColor}
            setChosenColor={(color) => setEditingOptions(prev => ({ ...prev, chosenColor: color }))}
            fontStyleChoice={editingOptions.fontStyleChoice}
            setFontStyleChoice={(style) => setEditingOptions(prev => ({ ...prev, fontStyleChoice: style }))}
            fontWeightChoice={editingOptions.fontWeightChoice}
            setFontWeightChoice={(weight) => setEditingOptions(prev => ({ ...prev, fontWeightChoice: weight }))}
            highlight={editingOptions.highlight}
            setHighlight={(highlight) => setEditingOptions(prev => ({ ...prev, highlight }))}
            highlightColor={editingOptions.highlightColor}
            setHighlightColor={(color) => setEditingOptions(prev => ({ ...prev, highlightColor: color }))}
            onSave={salvarEdicao}
            isDarkMode={isDarkMode}
            fontSize={settings.fontSize}
            buttonSize={settings.buttonSize}
            language={language}
            autoSaveEnabled={settings.autoSave}
            onAutoSave={handleAutoSave}
          />

          <SettingsModal 
            visible={settingsModalVisible}
            onClose={() => setSettingsModalVisible(false)}
            settings={settings}
            onSettingsChange={handleSettingsChange}
            isDarkMode={isDarkMode}
            language={language}
            isLoggedIn={!!user}
            onLogout={handleLogoutPress}
            onGoToLogin={onSwitchToAuth}
          />

          <View style={styles.headerContainer}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <Image source={require('./assets/go.png')} style={styles.logoIcon} />
                <Text style={styles.titulo}>{t.appName}</Text>
                {isSyncing && (
                  <View style={{marginLeft: 10, flexDirection: 'row', alignItems: 'center'}}>
                    <ActivityIndicator size="small" color="#4a90e2" />
                    <Text style={{color: '#4a90e2', fontSize: 12, marginLeft: 5}}>{t.syncing}</Text>
                  </View>
                )}
            </View>
            <TouchableOpacity 
                ref={settingsButtonRef}
                onPress={() => setSettingsModalVisible(true)}
            >
                <Ionicons name="ellipsis-vertical" size={24} color={styles.iconColor.color} />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.dataAtual}>
           {new Date().toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US', { 
             weekday: 'long', 
             year: 'numeric', 
             month: 'long', 
             day: 'numeric' 
           })}
          </Text>
 
          <View ref={inputAreaRef}>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder={t.addTask}
                placeholderTextColor={styles.placeholderColor.color}
                value={tarefaInput}
                onChangeText={setTarefaInput}
                multiline
                onSubmitEditing={adicionarTarefa}
                returnKeyType="done"
                textBreakStrategy="highQuality"
                allowFontScaling={true}/>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
                <Ionicons name="calendar-outline" size={22} color={styles.iconColor.color} />
                <Text style={styles.dateButtonText}>{dateShort(pickerDate, language)}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.botaoAdicionar} 
                onPress={adicionarTarefa}
                disabled={tarefaInput.trim() === ''}
              >
                <Ionicons 
                  name="add-circle" 
                  size={32} 
                  color={tarefaInput.trim() === '' ? styles.disabledButton.color : '#4a90e2'} 
                />
              </TouchableOpacity>
            </View>
          </View>
          
          {settings.showPreview && tarefaInput.length > 0 && (
              <PreviewCard
                text={tarefaInput}
                color={editingOptions.chosenColor}
                fontStyle={editingOptions.fontStyleChoice}
                fontWeight={editingOptions.fontWeightChoice}
                highlight={editingOptions.highlight}
                highlightColor={editingOptions.highlightColor}
                isDarkMode={isDarkMode}
                fontSize={settings.fontSize}
              />
          )}
 
          <View 
              ref={formatToolbarRef}
              style={styles.formatToolbar}
          >
            <Text style={styles.toolbarLabel}>{t.formatting}</Text>
            <View style={styles.toolbarOptions}>
              {defaultColors.map(c => (
                <TouchableOpacity 
                  key={c} 
                  onPress={() => setEditingOptions(prev => ({ ...prev, chosenColor: c }))} 
                  style={[styles.colorOptionSmall, { backgroundColor: c }, editingOptions.chosenColor === c && styles.colorOptionSelectedSmall, c === '#ffffff' && { borderWidth: 1, borderColor: isDarkMode ? '#ccc' : '#333' }]} 
                />
              ))}
              <TouchableOpacity 
                onPress={() => setEditingOptions(prev => ({ ...prev, fontStyleChoice: prev.fontStyleChoice === 'italic' ? null : 'italic' }))} 
                style={[styles.formatButtonSmall, editingOptions.fontStyleChoice === 'italic' && styles.formatButtonActiveSmall]}
              >
                <Text style={{ fontStyle: 'italic', color: styles.iconColor.color, fontSize: 16 }}>I</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setEditingOptions(prev => ({ ...prev, fontWeightChoice: prev.fontWeightChoice === 'bold' ? null : 'bold' }))} 
                style={[styles.formatButtonSmall, editingOptions.fontWeightChoice === 'bold' && styles.formatButtonActiveSmall]}
              >
                <Text style={{ fontWeight: 'bold', color: styles.iconColor.color, fontSize: 16 }}>B</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setEditingOptions(prev => ({ ...prev, highlight: !prev.highlight }))} 
                style={[styles.formatButtonSmall, editingOptions.highlight && styles.formatButtonActiveSmall]}
              >
                <Ionicons name="color-fill-outline" size={18} color={styles.iconColor.color} />
              </TouchableOpacity>
            </View>
          </View>
 
          {showDatePicker && (
            <DateTimePicker
              value={pickerDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, selectedDate) => {
                setShowDatePicker(Platform.OS === 'ios');
                if (selectedDate) setPickerDate(selectedDate);
              }}
            />
          )}
 
          {multiSelectMode && (
            <View style={styles.multiSelectActions}>
              <Text style={styles.selectedCount}>
                {selectedTasks.length} {selectedTasks.length === 1 ? t.selected : t.selectedPlural}
              </Text>
              <View style={styles.multiSelectButtons}>
                <TouchableOpacity style={styles.cancelButton} onPress={cancelMultiSelect}>
                  <Text style={styles.actionText}>{t.cancel}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteButton} onPress={deleteSelectedTasks}>
                  <Text style={styles.actionText}>{t.delete}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
 
          <ScrollView 
            onLayout={(e) => setScrollViewLayout(e.nativeEvent.layout)} 
            onScroll={(e) => { scrollY.value = e.nativeEvent.contentOffset.y; }} 
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            style={styles.mainScrollView}
            scrollEnabled={!showTutorial}
          >
            {displayStructure.map((block, idx) => {
              if (block.type === 'separator') {
                return (
                  <View key={`sep-${idx}`} style={styles.separator}>
                    <Text style={styles.separatorText}>{block.title}</Text>
                  </View>
                );
              }
              
              const key = block.displayKey;
              const tarefasDoDia = tarefasAgrupadas[key] || [];
 
              let diaInfo;
              if (block.type === 'future_day') {
                  const dateParts = key.split('/');
                  let dObj;
                  if (language === 'pt') { // DD/MM/YYYY
                      dObj = new Date(dateParts[2], dateParts[1] - 1, dateParts[0]);
                  } else { // MM/DD/YYYY
                      dObj = new Date(dateParts[2], dateParts[0] - 1, dateParts[1]);
                  }
                  const weekdayShort = weekDayNameFromDate(dObj, language);
                  diaInfo = {
                      displayKey: key, 
                      headerTitle: `${weekdayShort}, ${dateShort(dObj, language)}`, 
                      shortDate: dateShort(dObj, language) 
                  }
              } else {
                  diaInfo = { 
                      displayKey: key, 
                      headerTitle: block.nome, 
                      shortDate: block.shortDate 
                  }
              }
 
              return (
                <DiaDaSemana
                  key={key}
                  diaInfo={diaInfo}
                  tarefasList={tarefasDoDia}
                  onUpdateTarefa={handleUpdateTarefa}
                  onDeleteTarefa={handleDeleteTarefa}
                  onDuplicateTarefa={handleDuplicateTarefa}
                  onToggleFixadaTarefa={handleToggleFixadaTarefa}
                  multiSelectMode={multiSelectMode}
                  selectedTasks={selectedTasks}
                  onToggleSelectAllForDay={handleToggleSelectAllForDay}
                  isDarkMode={isDarkMode}
                  fontSize={settings.fontSize}
                  buttonSize={settings.buttonSize}
                  forwardedRef={idx === 0 ? taskListRef : null}
                  language={language}
                />
              );
            })}
            <View style={{ height: 20 }} />
          </ScrollView>

        </View>

        <TutorialModal 
            visible={showTutorial && tutorialReady}
            onFinish={handleFinishTutorial}
            layouts={tutorialLayouts}
            language={language}
        />

      </SafeAreaView>
    </DragAndDropContext.Provider>
  );
}

const useStyles = (isDarkMode = false, fontSize = 14, insets) => {
  return StyleSheet.create({
    // --- ESTILOS DE AUTENTICAÇÃO ---
    welcomeContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: isDarkMode ? '#121212' : '#f7f7f7',
    },
    welcomeLogo: {
        width: 80,
        height: 80,
        marginBottom: 20,
    },
    welcomeTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: isDarkMode ? '#fff' : '#0b2e63ff',
        marginBottom: 8,
    },
    welcomeSubtitle: {
        fontSize: 16,
        color: isDarkMode ? '#aaa' : '#666',
        textAlign: 'center',
        marginBottom: 40,
    },
    authFormContainer: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
        backgroundColor: isDarkMode ? '#1e1e1e' : '#fff',
    },
    authBackButton: {
        position: 'absolute',
        top: (insets?.top || 10) + 10,
        left: 20,
        zIndex: 1,
    },
    authTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        color: isDarkMode ? '#fff' : '#0b2e63ff',
        marginBottom: 8,
    },
    authSubtitle: {
        fontSize: 16,
        color: isDarkMode ? '#aaa' : '#666',
        marginBottom: 30,
    },
    inputGroup: {
        width: '100%',
        marginBottom: 15,
    },
    inputLabel: {
        color: isDarkMode ? '#ccc' : '#444',
        fontSize: 14,
        marginBottom: 6,
    },
    authInput: {
        width: '100%',
        height: 50,
        backgroundColor: isDarkMode ? '#333' : '#f2f2f2',
        borderRadius: 8,
        paddingHorizontal: 15,
        fontSize: 16,
        color: isDarkMode ? '#fff' : '#000',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    authInputError: {
        borderColor: '#d9534f',
    },
    passwordHint: {
        fontSize: 12,
        color: isDarkMode ? '#888' : '#777',
        marginTop: 6,
    },
    authButton: {
        width: '100%',
        height: 50,
        backgroundColor: '#4a90e2',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10,
    },
    authButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    authButtonSecondary: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#4a90e2',
        marginTop: 15,
    },
    authButtonTextSecondary: {
        color: '#4a90e2',
    },
    authLinkText: {
        color: '#4a90e2',
        marginTop: 20,
        textAlign: 'center',
    },
    authErrorText: {
        color: '#d9534f',
        marginBottom: 15,
        textAlign: 'center',
        fontWeight: '600'
    },
    welcomeDivider: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '80%',
        marginVertical: 20,
    },
    welcomeDividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: isDarkMode ? '#444' : '#ccc',
    },
    welcomeDividerText: {
        marginHorizontal: 10,
        color: isDarkMode ? '#888' : '#777',
    },

    // --- ESTILOS ORIGINAIS ---
    textWithOutline: {
      textShadowColor: isDarkMode ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.6)',
      textShadowRadius: 2,
      textShadowOffset: { width: 0.5, height: 0.5},
    },
    safeArea: {
      flex: 1,
      backgroundColor: isDarkMode ? '#121212' : '#f7f7f7'
    },
    container: { 
      flex: 1, 
      paddingHorizontal: 12,
      paddingTop: Platform.OS === 'android' ? 8 : 0,
      backgroundColor: isDarkMode ? '#121212' : '#f7f7f7' 
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDarkMode ? '#121212' : '#f7f7f7'
    },
    headerContainer: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      justifyContent: 'space-between', 
      marginBottom: 4,
      paddingTop: Platform.OS === 'ios' ? 8 : 12
    },
    logoIcon: {
        width: 32,
        height: 32,
        resizeMode: 'contain'
    },
    titulo: { 
      fontSize: 24, 
      fontWeight: '700', 
      color: isDarkMode ? '#fff' : '#4a90e2', 
      marginLeft: 8 
    },
    dataAtual: { 
      fontSize: 12, 
      color: isDarkMode ? '#A9A9A9' : '#666', 
      textAlign: 'center', 
      marginBottom: 8, 
      textTransform: 'capitalize' 
    },
    inputContainer: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      marginBottom: 8 
    },
    input: { 
      flex: 1, 
      borderWidth: 1, 
      borderColor: isDarkMode ? '#444' : '#ccc', 
      borderRadius: 10, 
      padding: 10, 
      fontSize: 14, 
      backgroundColor: isDarkMode ? '#1e1e1e' : '#fff', 
      color: isDarkMode ? '#fff' : '#000',
      minHeight: 42,
      maxHeight: 80
    },
    placeholderColor: { color: isDarkMode ? '#888' : '#999' },
    dateButton: {
      marginLeft: 8,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 6,
      borderRadius: 8,
      backgroundColor: isDarkMode ? '#1e1e1e' : '#f0f0f0',
      width: 50
    },
    dateButtonText: {
      fontSize: 10,
      color: isDarkMode ? '#fff' : '#000',
      marginTop: 2
    },
    botaoAdicionar: { 
      marginLeft: 6,
    },
    disabledButton: {
      color: isDarkMode ? '#555' : '#ccc'
    },
    previewContainer: {
      padding: 8,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: isDarkMode ? '#2a2a2a' : '#eee',
      backgroundColor: isDarkMode ? '#1e1e1e' : '#fff'
    },
    previewContent: {
      flexDirection: 'row',
      alignItems: 'center'
    },
    previewText: {
      fontSize: 14,
      flex: 1,
      color: isDarkMode ? '#fff' : '#000'
    },
    formatToolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
      padding: 8,
      borderRadius: 8,
      backgroundColor: isDarkMode ? '#1e1e1e' : '#f0f0f0',
    },
    toolbarLabel: {
      marginRight: 8,
      fontSize: 12,
      color: isDarkMode ? '#ddd' : '#666'
    },
    toolbarOptions: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      flexWrap: 'wrap'
    },
    colorOptionSmall: {
      width: 21,
      height: 21,
      marginRight: 6,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: isDarkMode ? '#444' : '#ddd'
    },
    colorOptionSelectedSmall: {
      borderWidth: 2,
      borderColor: isDarkMode ? '#fff' : '#000'
    },
    formatButtonSmall: {
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: 4,
      marginLeft: 6,
      borderWidth: 1,
      borderColor: isDarkMode ? '#444' : '#ddd',
      backgroundColor: isDarkMode ? '#333' : '#e9e9e9'
    },
    formatButtonActiveSmall: {
      borderColor: '#4a90e2',
      backgroundColor: isDarkMode ? '#1f1f1f' : '#e8f4ff'
    },
    mainScrollView: {
      flex: 1
    },
    diaContainer: { 
      marginBottom: 8, 
      backgroundColor: isDarkMode ? '#1e1e1e' : '#fff', 
      borderRadius: 8, 
      padding: 8, 
      overflow: 'hidden' 
    },
    diaHeader: { 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      alignItems: 'center',
      paddingVertical: 2
    },
    diaHeaderTitle: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    diaTexto: { 
      fontSize: 15, 
      fontWeight: '700', 
      color: isDarkMode ? '#eee' : '#333' 
    },
    diaDataTexto: { 
      fontSize: 12, 
      fontWeight: '400', 
      color: isDarkMode ? '#aaa' : '#666' 
    },
    selectAllDayButton: {
        marginRight: 10,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 5,
        backgroundColor: isDarkMode ? '#333' : '#e0e0e0'
    },
    selectAllDayButtonText: {
        color: isDarkMode ? '#fff' : '#000',
        fontSize: 11,
        fontWeight: 'bold'
    },
    tarefaItemContainer: { 
      flexDirection: 'row', 
      alignItems: 'flex-start', 
      justifyContent: 'space-between', 
      paddingVertical: 8, 
      borderTopWidth: 1, 
      borderTopColor: isDarkMode ? '#333' : '#eee', 
      marginTop: 6, 
      paddingHorizontal: 4, 
      borderRadius: 4 
    },
    tarefaPrincipal: { 
      flexDirection: 'row', 
      alignItems: 'flex-start', 
      flex: 1, 
      marginRight: 8 
    },
    tarefaCheckboxIcon: { 
      marginRight: 10, 
      marginTop: 2 
    },
    tarefaTexto: { 
      flex: 1, 
      fontSize: fontSize, 
      lineHeight: fontSize + 3,
      color: isDarkMode ? '#ddd' : '#333',
      flexShrink: 1, 
      includeFontPadding: false, 
      textAlignVertical: 'center',
},
    tarefaConcluida: { 
      textDecorationLine: 'line-through', 
      color: isDarkMode ? '#777' : '#999' 
    },
    tarefaAcoes: { 
      flexDirection: 'row', 
      alignItems: 'center' 
    },
    botaoAcao: { 
      marginLeft: 12
    },
    iconColor: { 
      color: isDarkMode ? '#fff' : '#000' 
    },
    emptyStateText: {
      color: isDarkMode ? '#666' : '#999',
      padding: 6,
      fontStyle: 'italic',
      fontSize: 12
    },
    modalOverlay: { 
      flex: 1, 
      backgroundColor: 'rgba(0,0,0,0.6)', 
      justifyContent: 'center', 
      alignItems: 'center',
    },
    modalContent: { 
      width: '90%', 
      backgroundColor: isDarkMode ? '#222' : '#fff', 
      borderRadius: 10, 
      overflow: 'hidden',
      elevation: 10 
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? '#444' : '#eee'
    },
    modalTitle: { 
      fontSize: 18, 
      fontWeight: '700', 
      color: isDarkMode ? '#fff' : '#000' 
    },
    autoSaveIndicator: {
      fontSize: 12,
      color: '#28a745',
      fontStyle: 'italic'
    },
    closeButton: {
      padding: 4,
      marginLeft: 8
    },
    modalScrollView: {
      paddingHorizontal: 14,
      paddingTop: 10,
    },
    modalInput: { 
      borderWidth: 1, 
      borderColor: isDarkMode ? '#444' : '#ccc', 
      borderRadius: 8, 
      padding: 10, 
      fontSize: 14, 
      backgroundColor: isDarkMode ? '#333' : '#f9f9f9', 
      color: isDarkMode ? '#fff' : '#000',
      minHeight: 100,
      textAlignVertical: 'top',
      marginBottom: 10
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: isDarkMode ? '#ddd' : '#666',
      marginBottom: 8
    },
    colorOption: {
      width: 28,
      height: 28,
      marginRight: 8,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: isDarkMode ? '#444' : '#ddd'
    },
    colorOptionSelected: {
      borderWidth: 2,
      borderColor: isDarkMode ? '#fff' : '#000'
    },
    formatButton: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: isDarkMode ? '#444' : '#ddd',
      backgroundColor: isDarkMode ? '#333' : '#f0f0f0'
    },
    formatButtonActive: {
      borderColor: '#4a90e2',
      backgroundColor: isDarkMode ? '#1f1f1f' : '#e8f4ff'
    },
    highlightOption: {
      width: 26,
      height: 26,
      borderRadius: 3,
      borderWidth: 1,
      borderColor: isDarkMode ? '#444' : '#ddd'
    },
    highlightOptionSelected: {
      borderWidth: 2,
      borderColor: isDarkMode ? '#fff' : '#000'
    },
    modalButtons: { 
      flexDirection: 'row', 
      justifyContent: 'flex-end', 
      padding: 14,
      borderTopWidth: 1,
      borderTopColor: isDarkMode ? '#444' : '#eee'
    },
    modalButton: { 
      paddingVertical: 8, 
      paddingHorizontal: 14, 
      borderRadius: 8, 
      marginLeft: 8 
    },
    modalButtonCancel: { 
      backgroundColor: isDarkMode ? '#555' : '#ccc' 
    },
    modalButtonSave: { 
      backgroundColor: '#4a90e2' 
    },
    modalButtonText: { 
      color: '#fff', 
      fontWeight: '700' 
    },
    multiSelectActions: { 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      marginBottom: 8, 
      padding: 8, 
      backgroundColor: isDarkMode ? '#1e1e1e' : '#e9e9e9', 
      borderRadius: 8 
    },
    selectedCount: { 
      fontSize: 14, 
      fontWeight: '700', 
      color: isDarkMode ? '#fff' : '#000' 
    },
    multiSelectButtons: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    cancelButton: { 
      backgroundColor: '#999', 
      paddingVertical: 5, 
      paddingHorizontal: 10, 
      borderRadius: 5, 
      marginRight: 8 
    },
    deleteButton: { 
      backgroundColor: '#d9534f', 
      paddingVertical: 5, 
      paddingHorizontal: 10, 
      borderRadius: 5 
    },
    actionText: { 
      color: '#fff', 
      fontWeight: '700',
      fontSize: 12
    },
    tarefaSelecionada: { 
      backgroundColor: isDarkMode ? '#2a2a2a' : '#d9eefc', 
      borderRadius: 4 
    },
    animatedTaskBackground: { 
      color: isDarkMode ? '#121212' : '#fafafa' 
    },
    separator: {
      marginVertical: 8,
      paddingHorizontal: 4
    },
    separatorText: {
      fontSize: 14,
      fontWeight: 'bold',
      color: isDarkMode ? '#eee' : '#333'
    },
    settingsContainer: {
        flex: 1,
        backgroundColor: isDarkMode ? '#121212' : '#f2f2f2',
    },
    settingsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: isDarkMode ? '#333' : '#ddd',
        backgroundColor: isDarkMode ? '#1e1e1e' : '#fff',
    },
    settingsTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: isDarkMode ? '#fff' : '#000',
    },
    settingsContent: {
        flex: 1,
        paddingHorizontal: 16,
    },
    settingsSectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: isDarkMode ? '#aaa' : '#666',
        marginTop: 16,
        marginBottom: 8,
    },
    settingsItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        backgroundColor: isDarkMode ? '#1e1e1e' : '#fff',
        borderRadius: 8,
        marginBottom: 12,
        paddingHorizontal: 12
    },
    settingsItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: isDarkMode ? '#1e1e1e' : '#fff',
        borderRadius: 8,
        marginBottom: 12,
        paddingHorizontal: 12,
        paddingVertical: 16
    },
    settingsItemContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1
    },
    settingsItemWide: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingVertical: 16,
        backgroundColor: isDarkMode ? '#1e1e1e' : '#fff',
        borderRadius: 8,
        marginBottom: 12,
        paddingHorizontal: 12
    },
    settingsItemText: {
        fontSize: 16,
        color: isDarkMode ? '#eee' : '#222',
        marginLeft: 16,
    },
    fontSizeSelector: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        backgroundColor: isDarkMode ? '#1e1e1e' : '#fff',
        borderRadius: 8,
        padding: 8,
        marginBottom: 12,
    },
    fontSizeButton: {
        paddingVertical: 8,
        paddingHorizontal: 24,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: isDarkMode ? '#555' : '#ccc',
    },
    fontSizeButtonActive: {
        backgroundColor: '#4a90e2',
        borderColor: '#4a90e2',
    },
    fontSizeButtonText: {
        color: isDarkMode ? '#fff' : '#000',
        fontWeight: 'bold',
    },
    fontSizeButtonTextActive: {
        color: '#fff',
    },
    aboutSection: {
        paddingTop: 16,
        alignItems: 'center',
        backgroundColor: isDarkMode ? '#121212' : '#f2f2f2',
    },
    aboutText: {
        fontSize: 14,
        color: isDarkMode ? '#888' : '#666',
        marginBottom: 4,
        textAlign: 'center'
    },
  });
};

export default App;