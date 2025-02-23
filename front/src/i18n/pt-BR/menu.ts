import type { BaseTranslation } from "../i18n-types";

const menu: BaseTranslation = {
    title: "Menu",
    icon: {
        open: {
            menu: "Abrir menu",
            invite: "Mostrar convite",
            register: "Registro",
            chat: "Abrir bate-papo",
            userlist: "Lista de usuários",
            openEmoji: "Open emoji selected popup",
            closeEmoji: "Close emoji menu",
        },
    },
    visitCard: {
        close: "Fechar",
    },
    profile: {
        edit: {
            name: "Edite seu nome",
            woka: "Edite seu personagem",
            companion: "Edite seu companheiro",
            camera: "Edite sua câmera",
        },
        login: "Entrar",
        logout: "Sair",
    },
    settings: {
        gameQuality: {
            title: "Qualidade do jogo",
            short: {
                high: "Alto (120 fps)",
                medium: "Médio (60 fps)",
                small: "Baixo (40 fps)",
                minimum: "Mínimo (20 fps)",
            },
            long: {
                high: "Alta qualidade de vídeo (120 fps)",
                medium: "Média qualidade de vídeo (60 fps, recomendado)",
                small: "Baixa qualidade de vídeo (40 fps)",
                minimum: "Mínima qualidade de vídeo (20 fps)",
            },
        },
        videoQuality: {
            title: "Qualidade de vídeo",
            short: {
                high: "Alto (30 fps)",
                medium: "Médio (20 fps)",
                small: "Baixo (10 fps)",
                minimum: "Mínimo (5 fps)",
            },
            long: {
                high: "Alta qualidade de vídeo (30 fps)",
                medium: "Média qualidade de vídeo (20 fps, recomendado)",
                small: "Baixa qualidade de vídeo (10 fps)",
                minimum: "Mínima qualidade de vídeo (5 fps)",
            },
        },
        language: {
            title: "Linguagem",
        },
        privacySettings: {
            title: "Modo ausente",
            explanation:
                'Enquanto a guia WorkAdventure em seu navegador não estiver visível. WorkAdventure muda para "modo ausente"',
            cameraToggle: 'Mantenha a câmera ativa no "modo ausente"',
            microphoneToggle: 'Mantenha o microfone ativo no "modo ausente"',
        },
        save: {
            warning: "(Salvar essas configurações reiniciará o jogo)",
            button: "Salvar",
        },
        fullscreen: "Tela cheia",
        notifications: "Notificações",
        cowebsiteTrigger: "Sempre pergunte antes de abrir sites e salas do Jitsi Meet",
        ignoreFollowRequest: "Ignorar solicitações para seguir outros usuários",
    },
    invite: {
        description: "Compartilhe o link da sala!",
        copy: "Copiar",
        share: "Compartilhar",
        walkAutomaticallyToPosition: "Caminhe automaticamente para a minha posição",
        selectEntryPoint: "Selecione um ponto de entrada",
    },
    globalMessage: {
        text: "Texto",
        audio: "Áudio",
        warning: "Transmissão para todas as salas do mundo",
        enter: "Digite sua mensagem aqui...",
        send: "Enviar",
    },
    globalAudio: {
        uploadInfo: "Enviar um arquivo",
        error: "Nenhum arquivo selecionado. Você precisa fazer o upload de um arquivo antes de enviá-lo.",
    },
    contact: {
        gettingStarted: {
            title: "Começando",
            description:
                "WorkAdventure permite que você crie um espaço online para se comunicar espontaneamente com outras pessoas. E tudo começa com a criação do seu próprio espaço. Escolha entre uma grande seleção de mapas pré-fabricados por nossa equipe.",
        },
        createMap: {
            title: "Crie seu mapa",
            description: "Você também pode criar seu próprio mapa personalizado seguindo a etapa da documentação.",
        },
    },
    about: {
        mapInfo: "Informações no mapa",
        mapLink: "link para este mapa",
        copyrights: {
            map: {
                title: "Direitos autorais do mapa",
                empty: "O criador do mapa não declarou direitos autorais para o mapa.",
            },
            tileset: {
                title: "Direitos autorais dos tilesets",
                empty: "O criador do mapa não declarou direitos autorais para os tilesets. Isso não significa que esses tilesets não tenham licença.",
            },
            audio: {
                title: "Direitos autorais de arquivos de áudio",
                empty: "O criador do mapa não declarou direitos autorais para arquivos de áudio. Isso não significa que esses arquivos de áudio não tenham licença.",
            },
        },
    },
    sub: {
        profile: "Perfil",
        settings: "Configurações",
        invite: "Convidar",
        credit: "Crédito",
        globalMessages: "Mensagens globais",
        contact: "Contato",
    },
};

export default menu;
