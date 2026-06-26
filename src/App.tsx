import React, { useState, useEffect, useRef } from "react";
// @ts-ignore
import { db, auth } from "./firebase";
import {
  doc,
  setDoc,
  onSnapshot,
  updateDoc,
  increment,
  collection,
  getDocs,
  arrayUnion,
  deleteDoc,
  getDoc,
  arrayRemove,
} from "firebase/firestore";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

// Colores deportivos predeterminados para ofrecer en la interfaz
const PALETA_COLORES = [
  { nombre: "Verde Éxito", hex: "#15803d" },
  { nombre: "Rojo Alerta", hex: "#b91c1c" },
  { nombre: "Azul Táctico", hex: "#1d4ed8" },
  { nombre: "Amarillo Alerta", hex: "#b45309" },
  { nombre: "Morado Especial", hex: "#6b21a8" },
  { nombre: "Gris Neutro", hex: "#4b5563" },
];

// Estructura base por si el profe no configuró nada todavía
const BOTONES_POR_DEFECTO = [
  {
    id: "ingresos_area_favor",
    nombre: "Área Favor",
    color: "#15803d",
    orden: 0,
  },
  {
    id: "ingresos_area_contra",
    nombre: "Área Contra",
    color: "#b91c1c",
    orden: 1,
  },
  { id: "tiros_favor", nombre: "Tiro Favor", color: "#166534", orden: 2 },
  { id: "tiros_contra", nombre: "Tiro Contra", color: "#991b1b", orden: 3 },
  { id: "cortos_favor", nombre: "Corto Favor", color: "#059669", orden: 4 },
  { id: "cortos_contra", nombre: "Corto Contra", color: "#e11d48", orden: 5 },
];

export default function App() {
  // --- ESTADOS DE AUTENTICACIÓN Y ROLES ---
  const [usuario, setUsuario] = useState<any>(null);
  const [perfilUsuario, setPerfilUsuario] = useState<any>(null);
  const [cargandoAuth, setCargandoAuth] = useState<boolean>(true);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [esRegistro, setEsRegistro] = useState<boolean>(false);
  const [errorAuth, setErrorAuth] = useState<string>("");

  // --- ESTADOS DE GESTIÓN DE EQUIPOS Y USUARIOS ---
  const [listaEquipos, setListaEquipos] = useState<any[]>([]);
  const [equipoSeleccionado, setEquipoSeleccionado] = useState<string>("");
  const [jugadorasDelEquipo, setJugadorasDelEquipo] = useState<string[]>([]);
  const [botonesDinamicos, setBotonesDinamicos] = useState<any[]>([]); // <--- Botones activos del equipo actual
  const [listaTodosLosProfes, setListaTodosLosProfes] = useState<any[]>([]);

  const [modoAdmin, setModoAdmin] = useState<boolean>(false);
  const [nuevoNombreEquipo, setNuevoNombreEquipo] = useState<string>("");
  const [nuevasJugadorasTexto, setNuevasJugadorasTexto] = useState<string>("");

  // Estados para la creación de un nuevo botón dinámico
  const [nuevoBtnNombre, setNuevoBtnNombre] = useState<string>("");
  const [nuevoBtnColor, setNuevoBtnColor] = useState<string>("#4b5563");

  // Estados de Configuración del Partido
  const [partidoIniciado, setPartidoIniciado] = useState<boolean>(false);
  const [vista, setVista] = useState<string>("telefono");
  const [rival, setRival] = useState<string>("");
  const [cancha, setCancha] = useState<string>("");
  const [fecha, setFecha] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [titulares, setTitulares] = useState<string[]>([]);
  const [suplentes, setSuplentes] = useState<string[]>([]);

  // Estados del Juego
  const [cuartoActual, setCuartoActual] = useState<string>("1Q");
  const [segundos, setSegundos] = useState<number>(0);
  const [corriendo, setCorriendo] = useState<boolean>(false);
  const idIntervalo = useRef<any>(null);
  const [idPartido, setIdPartido] = useState<string>("");

  const [estadisticas, setEstadisticas] = useState<any>({
    "1Q": {},
    "2Q": {},
    "3Q": {},
    "4Q": {},
  });

  // --- ESTADOS PARA EL HISTORIAL ---
  const [listaPartidosViejos, setListaPartidosViejos] = useState<any[]>([]);
  const [partidoHistorialSeleccionado, setPartidoHistorialSeleccionado] =
    useState<any>(null);
  const [vistaHistorial, setVistaHistorial] = useState<boolean>(false);

  // --- TIMER DEL CRONÓMETRO ---
  useEffect(() => {
    if (corriendo) {
      idIntervalo.current = setInterval(() => {
        setSegundos((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(idIntervalo.current);
    }
    return () => clearInterval(idIntervalo.current);
  }, [corriendo]);

  // --- CONTROLADOR DEL ESTADO DE SESIÓN ---
  useEffect(() => {
    const desuscribirAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUsuario(user);
        const docSnap = await getDoc(doc(db, "usuarios", user.uid));
        if (docSnap.exists()) {
          setPerfilUsuario(docSnap.data());
        } else {
          const defecto = {
            email: user.email,
            rol: "entrenador",
            categoriasPermitidas: [],
          };
          setPerfilUsuario(defecto);
        }
      } else {
        setUsuario(null);
        setPerfilUsuario(null);
        setListaEquipos([]);
        setListaPartidosViejos([]);
        setListaTodosLosProfes([]);
      }
      setCargandoAuth(false);
    });
    return () => desuscribirAuth();
  }, []);

  // --- CARGA CENTRALIZADA Y FILTRADA POR PERMISOS ---
  const cargarDatosClub = async (perfil: any) => {
    if (!perfil) return;
    try {
      const queryEquipos = await getDocs(collection(db, "equipos_club"));
      const todosLosEquipos: any[] = [];
      querySnapshotToArray(queryEquipos, todosLosEquipos);

      let equiposFiltrados = todosLosEquipos;
      if (perfil.rol !== "coordinador") {
        equiposFiltrados = todosLosEquipos.filter((eq) =>
          perfil.categoriasPermitidas?.includes(eq.id)
        );
      }
      setListaEquipos(equiposFiltrados);

      if (equiposFiltrados.length > 0) {
        // Seleccionar el primero por defecto si no hay uno fijado
        const inicialId =
          equipoSeleccionado &&
          equiposFiltrados.some((e) => e.id === equipoSeleccionado)
            ? equipoSeleccionado
            : equiposFiltrados[0].id;
        setEquipoSeleccionado(inicialId);
        const eqEncontrado = equiposFiltrados.find((e) => e.id === inicialId);
        setJugadorasDelEquipo(eqEncontrado?.jugadoras || []);

        // Cargar sus botones correspondientes
        const btns =
          eqEncontrado?.botones && eqEncontrado.botones.length > 0
            ? [...eqEncontrado.botones].sort((a, b) => a.orden - b.orden)
            : BOTONES_POR_DEFECTO;
        setBotonesDinamicos(btns);
      }

      const queryPartidos = await getDocs(collection(db, "partidos_club"));
      const todosLosPartidos: any[] = [];
      querySnapshotToArray(queryPartidos, todosLosPartidos);

      let partidosFiltrados = todosLosPartidos;
      if (perfil.rol !== "coordinador") {
        partidosFiltrados = todosLosPartidos.filter((part) =>
          perfil.categoriasPermitidas?.includes(part.id_categoria)
        );
      }
      partidosFiltrados.sort((a, b) => b.fecha.localeCompare(a.fecha));
      setListaPartidosViejos(partidosFiltrados);

      if (perfil.rol === "coordinador") {
        obtenerListaProfesDeFirestore();
      }
    } catch (e) {
      console.error("Error al cargar datos globales del club: ", e);
    }
  };

  const obtenerListaProfesDeFirestore = async () => {
    try {
      const snapUsers = await getDocs(collection(db, "usuarios"));
      const profesCargados: any[] = [];
      snapUsers.forEach((doc) => {
        profesCargados.push({ id: doc.id, ...doc.data() });
      });
      setListaTodosLosProfes(profesCargados);
    } catch (err) {
      console.error(err);
    }
  };

  const querySnapshotToArray = (snapshot: any, arr: any[]) => {
    snapshot.forEach((doc: any) => {
      arr.push({ id: doc.id, ...doc.data() });
    });
  };

  useEffect(() => {
    if (perfilUsuario) {
      cargarDatosClub(perfilUsuario);
    }
  }, [perfilUsuario]);

  // Sincronizar botones al cambiar el selector de categoría
  const manejarCambioEquipo = (id: string) => {
    setEquipoSeleccionado(id);
    const equipo = listaEquipos.find((eq) => eq.id === id);
    setJugadorasDelEquipo(equipo ? equipo.jugadoras : []);
    const btns =
      equipo?.botones && equipo.botones.length > 0
        ? [...equipo.botones].sort((a, b) => a.orden - b.orden)
        : BOTONES_POR_DEFECTO;
    setBotonesDinamicos(btns);
    setTitulares([]);
    setSuplentes([]);
  };

  // --- CONTROLADOR DE PERMISOS DE PROFES ---
  const alternarPermisoCategoria = async (
    idProfe: string,
    idCat: string,
    tienePermiso: boolean
  ) => {
    try {
      const profeRef = doc(db, "usuarios", idProfe);
      if (tienePermiso) {
        await updateDoc(profeRef, { categoriasPermitidas: arrayRemove(idCat) });
      } else {
        await updateDoc(profeRef, { categoriasPermitidas: arrayUnion(idCat) });
      }
      await obtenerListaProfesDeFirestore();
    } catch (err) {
      console.error(err);
    }
  };

  // --- CONTROL DE BOTONES DINÁMICOS POR CATEGORÍA ---
  const guardarBotonesEnFirestore = async (nuevosBotones: any[]) => {
    if (!equipoSeleccionado) return;
    try {
      const eqRef = doc(db, "equipos_club", equipoSeleccionado);
      await updateDoc(eqRef, { botones: nuevosBotones });
      setBotonesDinamicos(nuevosBotones.sort((a, b) => a.orden - b.orden));
      // Actualizar lista global de equipos local
      setListaEquipos((prev) =>
        prev.map((eq) =>
          eq.id === equipoSeleccionado ? { ...eq, botones: nuevosBotones } : eq
        )
      );
    } catch (err) {
      console.error(err);
    }
  };

  const agregarNuevoBoton = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoBtnNombre.trim()) return;
    const idSugerido =
      "btn_" +
      nuevoBtnNombre.toLowerCase().replace(/ /g, "_") +
      "_" +
      Date.now().toString().slice(-4);
    const nuevoObj = {
      id: idSugerido,
      nombre: nuevoBtnNombre,
      color: nuevoBtnColor,
      orden: botonesDinamicos.length,
    };
    const listaActualizada = [...botonesDinamicos, nuevoObj];
    guardarBotonesEnFirestore(listaActualizada);
    setNuevoBtnNombre("");
  };

  const eliminarBotonDinamico = (idBtn: string) => {
    if (!window.confirm("¿Querés eliminar esta métrica de la botonera?"))
      return;
    const listaFiltrada = botonesDinamicos
      .filter((b) => b.id !== idBtn)
      .map((b, index) => ({ ...b, orden: index }));
    guardarBotonesEnFirestore(listaFiltrada);
  };

  const moverOrdenBoton = (index: number, direccion: "subir" | "bajar") => {
    if (direccion === "subir" && index === 0) return;
    if (direccion === "bajar" && index === botonesDinamicos.length - 1) return;

    const nuevaLista = [...botonesDinamicos];
    const objetivoIdx = direccion === "subir" ? index - 1 : index + 1;

    // Intercambiar posiciones
    const temp = nuevaLista[index];
    nuevaLista[index] = nuevaLista[objetivoIdx];
    nuevaLista[objetivoIdx] = temp;

    // Reasignar propiedad 'orden' secuencial
    const listaCorregida = nuevaLista.map((b, i) => ({ ...b, orden: i }));
    guardarBotonesEnFirestore(listaCorregida);
  };

  // --- MANEJO DE LOGIN / REGISTRO ---
  const manejarAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorAuth("");
    if (!email.trim() || !password.trim())
      return setErrorAuth("Completa todos los campos");

    try {
      if (esRegistro) {
        const credencial = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        await setDoc(doc(db, "usuarios", credencial.user.uid), {
          email: email,
          rol: "entrenador",
          categoriasPermitidas: [],
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      console.error(error);
      setErrorAuth("Ocurrió un error en la autenticación. Revisá los datos.");
    }
  };

  const cerrarSesion = () => {
    if (window.confirm("¿Querés cerrar sesión?")) {
      signOut(auth);
      setPartidoIniciado(false);
    }
  };

  const crearNuevoEquipo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoNombreEquipo.trim() || !perfilUsuario) return;
    if (perfilUsuario.rol !== "coordinador")
      return alert("Solo el coordinador puede crear categorías.");

    const idSugerido = nuevoNombreEquipo.toLowerCase().replace(/ /g, "_");
    try {
      await setDoc(doc(db, "equipos_club", idSugerido), {
        nombre: nuevoNombreEquipo,
        jugadoras: [],
        botones: BOTONES_POR_DEFECTO,
      });
      setNuevoNombreEquipo("");
      const queryEquipos = await getDocs(collection(db, "equipos_club"));
      const todosLosEquipos: any[] = [];
      querySnapshotToArray(queryEquipos, todosLosEquipos);
      setListaEquipos(todosLosEquipos);
    } catch (e) {
      console.error(e);
    }
  };

  const agregarJugadorasAlEquipo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevasJugadorasTexto.trim() || !equipoSeleccionado || !perfilUsuario)
      return;
    const nuevasJugadorasArr = nuevasJugadorasTexto
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name.length > 0);
    try {
      await updateDoc(doc(db, "equipos_club", equipoSeleccionado), {
        jugadoras: arrayUnion(...nuevasJugadorasArr),
      });
      setNuevasJugadorasTexto("");
      await cargarDatosClub(perfilUsuario);
    } catch (e) {
      console.error(e);
    }
  };

  const eliminarJugadoraIndividual = async (nombreJugadora: string) => {
    if (!perfilUsuario) return;
    const seguro = window.confirm(`¿Querés eliminar a ${nombreJugadora}?`);
    if (!seguro) return;
    try {
      const nuevoArray = jugadorasDelEquipo.filter((j) => j !== nombreJugadora);
      await updateDoc(doc(db, "equipos_club", equipoSeleccionado), {
        jugadoras: nuevoArray,
      });
      setJugadorasDelEquipo(nuevoArray);
      await cargarDatosClub(perfilUsuario);
    } catch (e) {
      console.error(e);
    }
  };

  // --- ESCUCHA EN VIVO DEL PARTIDO ---
  useEffect(() => {
    if (!idPartido || !usuario) return;
    const desuscribir = onSnapshot(
      doc(db, "partidos_club", idPartido),
      (docSnap) => {
        if (docSnap.exists()) {
          const datos = docSnap.data();
          if (datos.estadisticas) {
            setEstadisticas(datos.estadisticas);
          }
          if (datos.rival) setRival(datos.rival);
          if (datos.cancha) setCancha(datos.cancha);
          if (datos.fecha) setFecha(datos.fecha);
          if (datos.titulares) setTitulares(datos.titulares);
          if (datos.suplentes) setSuplentes(datos.suplentes);
          setPartidoIniciado(true);
        }
      }
    );
    return () => desuscribir();
  }, [idPartido, usuario]);

  const comenzarPartidoEnBaseDeDatos = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rival.trim() || !usuario) return alert("Poné el nombre del rival");
    const equipoActual = listaEquipos.find(
      (eq) => eq.id === equipoSeleccionado
    );
    const nuevoId = `${fecha}_${equipoSeleccionado}_vs_${rival
      .toLowerCase()
      .replace(/ /g, "_")}`;
    setIdPartido(nuevoId);

    // Inicializar estructura limpia de estadísticas para el partido basada en los botones del equipo
    const estructuraInicialEstadisticas: any = {
      "1Q": {},
      "2Q": {},
      "3Q": {},
      "4Q": {},
    };
    ["1Q", "2Q", "3Q", "4Q"].forEach((q) => {
      botonesDinamicos.forEach((b) => {
        estructuraInicialEstadisticas[q][b.id] = 0;
      });
    });

    await setDoc(doc(db, "partidos_club", nuevoId), {
      id_partido: nuevoId,
      id_categoria: equipoSeleccionado,
      club_local: "Talleres de Paraná",
      categoria: equipoActual ? equipoActual.nombre : "",
      rival,
      cancha,
      fecha,
      titulares,
      suplentes,
      estadisticas: estructuraInicialEstadisticas,
      configuracion_botones: botonesDinamicos, // Guardamos la foto de cómo eran los botones en este partido
    });
    setPartidoIniciado(true);
  };

  const manejarSuma = async (campo: string) => {
    if (!usuario) return;
    const valorActual = estadisticas[cuartoActual]?.[campo] || 0;
    try {
      await updateDoc(doc(db, "partidos_club", idPartido), {
        [`estadisticas.${cuartoActual}.${campo}`]: valorActual + 1,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const manejarResta = async (campo: string) => {
    if (!usuario) return;
    const valorActual = estadisticas[cuartoActual]?.[campo] || 0;
    if (valorActual <= 0) return;
    try {
      await updateDoc(doc(db, "partidos_club", idPartido), {
        [`estadisticas.${cuartoActual}.${campo}`]: valorActual - 1,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const finalizarPartido = () => {
    const seguro = window.confirm("¿Querés cerrar la mesa de control?");
    if (seguro && perfilUsuario) {
      setCorriendo(false);
      setSegundos(0);
      setPartidoIniciado(false);
      setIdPartido("");
      setRival("");
      setCancha("");
      setTitulares([]);
      setSuplentes([]);
      cargarDatosClub(perfilUsuario);
    }
  };

  const reingresarAPartido = (p: any) => {
    setIdPartido(p.id);
    setRival(p.rival);
    setCancha(p.cancha || "");
    setFecha(p.fecha);
    setTitulares(p.titulares || []);
    setSuplentes(p.suplentes || []);
    if (p.estadisticas) setEstadisticas(p.estadisticas);
    if (p.configuracion_botones) setBotonesDinamicos(p.configuracion_botones);
    setVistaHistorial(false);
    setPartidoHistorialSeleccionado(null);
    setPartidoIniciado(true);
  };

  const calcularTotal = (campo: string, objEsts: any = estadisticas) => {
    if (!objEsts) return 0;
    return (
      (objEsts["1Q"]?.[campo] || 0) +
      (objEsts["2Q"]?.[campo] || 0) +
      (objEsts["3Q"]?.[campo] || 0) +
      (objEsts["4Q"]?.[campo] || 0)
    );
  };

  const exportarAExcel = async (partidoEspecifico: any = null) => {
    const pTarget = partidoEspecifico || {
      rival,
      fecha,
      cancha,
      titulares,
      suplentes,
      estadisticas,
      configuracion_botones: botonesDinamicos,
    };
    const btnsFicha = pTarget.configuracion_botones || BOTONES_POR_DEFECTO;

    try {
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Planilla de Juego");
      worksheet.columns = [
        { width: 26 },
        { width: 14 },
        { width: 14 },
        { width: 14 },
        { width: 14 },
        { width: 16 },
      ];

      worksheet.mergeCells("A2:F2");
      worksheet.getCell("A2").value =
        "PLANILLA PERSONALIZADA DE ANÁLISIS DE PARTIDO";
      worksheet.getCell("A2").font = { name: "Calibri", bold: true, size: 14 };
      worksheet.getCell("A2").alignment = { horizontal: "center" };

      worksheet.getCell("A4").value = "Categoría:";
      worksheet.getCell("B4").value = pTarget.categoria || "Talleres";
      worksheet.getCell("C4").value = "Rival:";
      worksheet.getCell("D4").value = pTarget.rival;
      worksheet.getCell("E4").value = "Fecha:";
      worksheet.getCell("F4").value = pTarget.fecha;

      // Encabezados de tabla dinámica
      const filaTabla = 8;
      const encabezados = [
        "Métrica / Botón",
        "1° Cuarto",
        "2° Cuarto",
        "3° Cuarto",
        "4° Cuarto",
        "TOTAL",
      ];
      encabezados.forEach((text, idx) => {
        const cell = worksheet.getCell(filaTabla, idx + 1);
        cell.value = text;
        cell.font = { bold: true };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFEFEFEF" },
        };
      });

      btnsFicha.forEach((btn: any, bIdx: number) => {
        const fAct = filaTabla + 1 + bIdx;
        worksheet.getCell(fAct, 1).value = btn.nombre;
        worksheet.getCell(fAct, 2).value =
          pTarget.estadisticas?.["1Q"]?.[btn.id] || 0;
        worksheet.getCell(fAct, 3).value =
          pTarget.estadisticas?.["2Q"]?.[btn.id] || 0;
        worksheet.getCell(fAct, 4).value =
          pTarget.estadisticas?.["3Q"]?.[btn.id] || 0;
        worksheet.getCell(fAct, 5).value =
          pTarget.estadisticas?.["4Q"]?.[btn.id] || 0;
        worksheet.getCell(fAct, 6).value = calcularTotal(
          btn.id,
          pTarget.estadisticas
        );
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Estadisticas_${pTarget.fecha}_vs_${pTarget.rival.replace(
        / /g,
        "_"
      )}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err);
    }
  };

  const asignarRol = (nombre: string, rol: string) => {
    const tFiltrado = titulares.filter((j) => j !== nombre);
    const sFiltrado = suplentes.filter((j) => j !== nombre);
    if (rol === "titular") {
      setTitulares([...tFiltrado, nombre]);
      setSuplentes(sFiltrado);
    } else if (rol === "suplente") {
      setSuplentes([...sFiltrado, nombre]);
      setTitulares(tFiltrado);
    } else {
      setTitulares(tFiltrado);
      setSuplentes(sFiltrado);
    }
  };

  const formatearTiempo = (totSegundos: number) => {
    const min = Math.floor(totSegundos / 60);
    const seg = totSegundos % 60;
    return `${min.toString().padStart(2, "0")}:${seg
      .toString()
      .padStart(2, "0")}`;
  };

  const estiloInput: React.CSSProperties = {
    width: "100%",
    padding: "10px",
    borderRadius: "6px",
    backgroundColor: "#374151",
    border: "1px solid #4b5563",
    color: "white",
    boxSizing: "border-box",
  };
  const estiloCeldaTh: React.CSSProperties = {
    border: "1px solid #4b5563",
    padding: "12px",
    backgroundColor: "#1f2937",
    color: "#f3f4f6",
  };
  const estiloCeldaTd: React.CSSProperties = {
    border: "1px solid #374151",
    padding: "12px",
    textAlign: "center",
  };

  // --- COMPONENTE DE BOTÓN DINÁMICO E INTELIGENTE ---
  const ComponenteBotonDinamico = ({ objetoBoton }: { objetoBoton: any }) => {
    const tiempoInicioRef = useRef<number>(0);
    const yaRostoRef = useRef<boolean>(false);
    const timerRestaRef = useRef<any>(null);

    const presionarBoton = (e: any) => {
      if (e.type === "touchstart") e.preventDefault();
      tiempoInicioRef.current = Date.now();
      yaRostoRef.current = false;
      timerRestaRef.current = setTimeout(() => {
        manejarResta(objetoBoton.id);
        yaRostoRef.current = true;
        if (navigator.vibrate) navigator.vibrate(55);
      }, 450);
    };

    const soltarBoton = (e: any) => {
      if (e.type === "touchend") e.preventDefault();
      clearTimeout(timerRestaRef.current);
      if (Date.now() - tiempoInicioRef.current < 400 && !yaRostoRef.current) {
        manejarSuma(objetoBoton.id);
      }
    };

    return (
      <button
        onMouseDown={presionarBoton}
        onMouseUp={soltarBoton}
        onTouchStart={presionarBoton}
        onTouchEnd={soltarBoton}
        style={{
          backgroundColor: objetoBoton.color || "#4b5563",
          color: "white",
          border: "none",
          borderRadius: "12px",
          padding: "20px 12px",
          fontWeight: "bold",
          fontSize: "18px",
          cursor: "pointer",
          userSelect: "none",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: "6px",
          boxShadow: "0 4px 6px -1px rgba(0,0,0,0.3)",
          width: "100%",
        }}
      >
        <span
          style={{
            fontSize: "14px",
            opacity: 0.95,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            textAlign: "center",
          }}
        >
          {objetoBoton.nombre}
        </span>
        <span
          style={{
            fontSize: "28px",
            fontFamily: "monospace",
            fontWeight: "black",
          }}
        >
          {estadisticas[cuartoActual]?.[objetoBoton.id] || 0}
        </span>
      </button>
    );
  };

  if (cargandoAuth) {
    return (
      <div
        style={{
          backgroundColor: "#111827",
          color: "white",
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontFamily: "sans-serif",
        }}
      >
        <h2>🔄 Cargando Sistema de Hockey Personalizable...</h2>
      </div>
    );
  }

  if (!usuario) {
    return (
      <div
        style={{
          backgroundColor: "#111827",
          color: "white",
          minHeight: "100vh",
          fontFamily: "sans-serif",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "16px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            maxWidth: "400px",
            width: "100%",
            backgroundColor: "#1f2937",
            padding: "28px",
            borderRadius: "12px",
            border: "1px solid #374151",
            boxShadow: "0 10px 15px -3px rgba(0,0,0,0.5)",
          }}
        >
          <h2
            style={{
              textAlign: "center",
              color: "#60a5fa",
              marginTop: 0,
              marginBottom: "6px",
            }}
          >
            🏑 CONTROL DE ESTADÍSTICAS
          </h2>
          <p
            style={{
              textAlign: "center",
              color: "#9ca3af",
              fontSize: "14px",
              marginTop: 0,
              marginBottom: "24px",
            }}
          >
            Métricas Adaptativas por Categoría
          </p>
          <form
            onSubmit={manejarAuth}
            style={{ display: "flex", flexDirection: "column", gap: "14px" }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "4px",
                  fontSize: "14px",
                }}
              >
                Correo Electrónico:
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="dt@talleres.com"
                style={estiloInput as any}
                required
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "4px",
                  fontSize: "14px",
                }}
              >
                Contraseña:
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="******"
                style={estiloInput as any}
                required
              />
            </div>
            {errorAuth && (
              <div
                style={{
                  color: "#ef4444",
                  fontSize: "14px",
                  textAlign: "center",
                }}
              >
                ⚠️ {errorAuth}
              </div>
            )}
            <button
              type="submit"
              style={{
                marginTop: "8px",
                padding: "12px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: "#2563eb",
                color: "white",
                fontWeight: "bold",
                fontSize: "16px",
                cursor: "pointer",
              }}
            >
              {esRegistro ? "🚀 Registrar Nuevo Técnico" : "🔑 Iniciar Sesión"}
            </button>
          </form>
          <div
            style={{ textAlign: "center", marginTop: "18px", fontSize: "14px" }}
          >
            <button
              onClick={() => setEsRegistro(!esRegistro)}
              style={{
                background: "none",
                border: "none",
                color: "#60a5fa",
                cursor: "pointer",
                fontWeight: "bold",
                textDecoration: "underline",
              }}
            >
              {esRegistro ? "Iniciá Sesión acá" : "Registrate acá"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: "#111827",
        color: "white",
        minHeight: "100vh",
        fontFamily: "sans-serif",
        padding: "16px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          maxWidth: partidoIniciado ? "100%" : "500px",
          margin: "0 auto 12px auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "#1f2937",
          padding: "10px 14px",
          borderRadius: "8px",
          border: "1px solid #374151",
        }}
      >
        <span style={{ fontSize: "13px", color: "#9ca3af" }}>
          🏃‍♂️ Rol:{" "}
          <b style={{ color: "#60a5fa" }}>
            {perfilUsuario?.rol?.toUpperCase()}
          </b>{" "}
          ({usuario.email})
        </span>
        <button
          onClick={cerrarSesion}
          style={{
            padding: "4px 10px",
            backgroundColor: "#374151",
            color: "#f3f4f6",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px",
          }}
        >
          🚪 Salir
        </button>
      </div>

      {!partidoIniciado ? (
        <div
          style={{
            maxWidth: "500px",
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => setModoAdmin(!modoAdmin)}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: modoAdmin ? "#ef4444" : "#4f46e5",
                color: "white",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              {modoAdmin ? "❌ Cerrar Panel" : "⚙️ Plantel / Botonera"}
            </button>
            <button
              onClick={() => {
                setVistaHistorial(!vistaHistorial);
                setPartidoHistorialSeleccionado(null);
              }}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: vistaHistorial ? "#ef4444" : "#0284c7",
                color: "white",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              {vistaHistorial ? "❌ Cerrar Historial" : "📂 Historial Partidos"}
            </button>
          </div>

          {/* HISTORIAL */}
          {vistaHistorial && (
            <div
              style={{
                backgroundColor: "#1e293b",
                padding: "20px",
                borderRadius: "12px",
                border: "2px solid #0284c7",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <h3
                style={{ marginTop: 0, color: "#38bdf8", textAlign: "center" }}
              >
                📁 PANEL DE HISTORIAL
              </h3>
              {!partidoHistorialSeleccionado ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    maxHeight: "250px",
                    overflowY: "auto",
                  }}
                >
                  {listaPartidosViejos.filter(
                    (p) => p.id_categoria === equipoSeleccionado
                  ).length === 0 ? (
                    <div
                      style={{
                        fontSize: "13px",
                        color: "#94a3b8",
                        textAlign: "center",
                      }}
                    >
                      No hay partidos para esta categoría.
                    </div>
                  ) : (
                    listaPartidosViejos
                      .filter((p) => p.id_categoria === equipoSeleccionado)
                      .map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setPartidoHistorialSeleccionado(p)}
                          style={{
                            padding: "12px",
                            backgroundColor: "#334155",
                            border: "1px solid #475569",
                            borderRadius: "8px",
                            color: "white",
                            textAlign: "left",
                            cursor: "pointer",
                            display: "flex",
                            justifyContent: "space-between",
                          }}
                        >
                          <span>
                            📅 {p.fecha} - <b>vs {p.rival}</b>
                          </span>
                          <span style={{ color: "#38bdf8", fontSize: "13px" }}>
                            Ver ➡️
                          </span>
                        </button>
                      ))
                  )}
                </div>
              ) : (
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "12px",
                    }}
                  >
                    <button
                      onClick={() => setPartidoHistorialSeleccionado(null)}
                      style={{
                        padding: "6px 12px",
                        backgroundColor: "#475569",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                      }}
                    >
                      ⬅️ Volver
                    </button>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        onClick={() =>
                          reingresarAPartido(partidoHistorialSeleccionado)
                        }
                        style={{
                          padding: "6px 12px",
                          backgroundColor: "#2563eb",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          fontWeight: "bold",
                          cursor: "pointer",
                        }}
                      >
                        🏑 Reabrir
                      </button>
                      <button
                        onClick={() =>
                          exportarAExcel(partidoHistorialSeleccionado)
                        }
                        style={{
                          padding: "6px 12px",
                          backgroundColor: "#16a34a",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          fontWeight: "bold",
                          cursor: "pointer",
                        }}
                      >
                        📥 Excel
                      </button>
                    </div>
                  </div>
                  <div
                    style={{
                      backgroundColor: "#0f172a",
                      padding: "12px",
                      borderRadius: "8px",
                      fontSize: "14px",
                      marginBottom: "12px",
                    }}
                  >
                    <div>
                      📌 <b>Rival:</b> {partidoHistorialSeleccionado.rival} |
                      Cancha: {partidoHistorialSeleccionado.cancha || "Agua"}
                    </div>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: "12px",
                        backgroundColor: "#0f172a",
                      }}
                    >
                      <thead>
                        <tr>
                          <th
                            style={{
                              border: "1px solid #334155",
                              padding: "6px",
                              backgroundColor: "#1e293b",
                            }}
                          >
                            Métrica
                          </th>
                          <th
                            style={{
                              border: "1px solid #334155",
                              padding: "6px",
                              backgroundColor: "#1e293b",
                            }}
                          >
                            1Q
                          </th>
                          <th
                            style={{
                              border: "1px solid #334155",
                              padding: "6px",
                              backgroundColor: "#1e293b",
                            }}
                          >
                            2Q
                          </th>
                          <th
                            style={{
                              border: "1px solid #334155",
                              padding: "6px",
                              backgroundColor: "#1e293b",
                            }}
                          >
                            3Q
                          </th>
                          <th
                            style={{
                              border: "1px solid #334155",
                              padding: "6px",
                              backgroundColor: "#1e293b",
                            }}
                          >
                            4Q
                          </th>
                          <th
                            style={{
                              border: "1px solid #334155",
                              padding: "6px",
                              backgroundColor: "#2563eb",
                            }}
                          >
                            TOT
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(
                          partidoHistorialSeleccionado.configuracion_botones ||
                          BOTONES_POR_DEFECTO
                        ).map((btn: any) => {
                          const q1 =
                            partidoHistorialSeleccionado.estadisticas?.["1Q"]?.[
                              btn.id
                            ] || 0;
                          const q2 =
                            partidoHistorialSeleccionado.estadisticas?.["2Q"]?.[
                              btn.id
                            ] || 0;
                          const q3 =
                            partidoHistorialSeleccionado.estadisticas?.["3Q"]?.[
                              btn.id
                            ] || 0;
                          const q4 =
                            partidoHistorialSeleccionado.estadisticas?.["4Q"]?.[
                              btn.id
                            ] || 0;
                          return (
                            <tr key={btn.id}>
                              <td
                                style={{
                                  border: "1px solid #334155",
                                  padding: "6px",
                                  fontWeight: "bold",
                                }}
                              >
                                {btn.nombre}
                              </td>
                              <td
                                style={{
                                  border: "1px solid #334155",
                                  padding: "6px",
                                  textAlign: "center",
                                }}
                              >
                                {q1}
                              </td>
                              <td
                                style={{
                                  border: "1px solid #334155",
                                  padding: "6px",
                                  textAlign: "center",
                                }}
                              >
                                {q2}
                              </td>
                              <td
                                style={{
                                  border: "1px solid #334155",
                                  padding: "6px",
                                  textAlign: "center",
                                }}
                              >
                                {q3}
                              </td>
                              <td
                                style={{
                                  border: "1px solid #334155",
                                  padding: "6px",
                                  textAlign: "center",
                                }}
                              >
                                {q4}
                              </td>
                              <td
                                style={{
                                  border: "1px solid #334155",
                                  padding: "6px",
                                  textAlign: "center",
                                  fontWeight: "bold",
                                  backgroundColor: "#1e3a8a",
                                }}
                              >
                                {q1 + q2 + q3 + q4}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PANEL ADMIN: CONFIGURACIÓN GENERAL Y BOTONERA */}
          {modoAdmin && (
            <div
              style={{
                backgroundColor: "#1e293b",
                padding: "20px",
                borderRadius: "12px",
                border: "2px dashed #4f46e5",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <h3 style={{ marginTop: 0, color: "#818cf8" }}>
                ⚙️ CONFIGURACIÓN Y PERMISOS
              </h3>

              {perfilUsuario?.rol === "coordinador" && (
                <>
                  <form
                    onSubmit={crearNuevoEquipo}
                    style={{
                      display: "flex",
                      gap: "8px",
                      borderBottom: "1px solid #374151",
                      paddingBottom: "12px",
                    }}
                  >
                    <input
                      type="text"
                      value={nuevoNombreEquipo}
                      onChange={(e) => setNuevoNombreEquipo(e.target.value)}
                      placeholder="Ej: Sub 14 Damas"
                      style={estiloInput as any}
                    />
                    <button
                      type="submit"
                      style={{
                        padding: "10px 16px",
                        backgroundColor: "#10b981",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        fontWeight: "bold",
                        cursor: "pointer",
                      }}
                    >
                      + Crear
                    </button>
                  </form>
                  <div
                    style={{
                      backgroundColor: "#111827",
                      padding: "12px",
                      borderRadius: "8px",
                      border: "1px solid #374151",
                    }}
                  >
                    <h4
                      style={{
                        marginTop: 0,
                        color: "#60a5fa",
                        marginBottom: "8px",
                      }}
                    >
                      📋 Permisos de Profes
                    </h4>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                        maxHeight: "150px",
                        overflowY: "auto",
                        fontSize: "12px",
                      }}
                    >
                      {listaTodosLosProfes
                        .filter((p) => p.rol !== "coordinador")
                        .map((profe) => (
                          <div
                            key={profe.id}
                            style={{
                              backgroundColor: "#1f2937",
                              padding: "8px",
                              borderRadius: "4px",
                            }}
                          >
                            <div
                              style={{
                                fontWeight: "bold",
                                marginBottom: "4px",
                              }}
                            >
                              📧 {profe.email}
                            </div>
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "6px",
                              }}
                            >
                              {listaEquipos.map((eq) => {
                                const tieneAcceso =
                                  profe.categoriasPermitidas?.includes(eq.id);
                                return (
                                  <label
                                    key={eq.id}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "3px",
                                      backgroundColor: tieneAcceso
                                        ? "#1e3a8a"
                                        : "#374151",
                                      padding: "2px 4px",
                                      borderRadius: "3px",
                                      cursor: "pointer",
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={!!tieneAcceso}
                                      onChange={() =>
                                        alternarPermisoCategoria(
                                          profe.id,
                                          eq.id,
                                          !!tieneAcceso
                                        )
                                      }
                                    />
                                    {eq.nombre}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </>
              )}

              {/* NUEVO SUB-PANEL: ARMAR BOTONERA PERSONALIZADA */}
              {equipoSeleccionado && (
                <div
                  style={{
                    backgroundColor: "#111827",
                    padding: "14px",
                    borderRadius: "8px",
                    border: "1px solid #4f46e5",
                  }}
                >
                  <h4
                    style={{
                      marginTop: 0,
                      color: "#818cf8",
                      marginBottom: "4px",
                    }}
                  >
                    🎛️ Editar Botonera (
                    {
                      listaEquipos.find((e) => e.id === equipoSeleccionado)
                        ?.nombre
                    }
                    )
                  </h4>
                  <p
                    style={{
                      fontSize: "11px",
                      color: "#94a3b8",
                      marginTop: 0,
                      marginBottom: "12px",
                    }}
                  >
                    Personalizá el nombre, color y orden de las métricas en
                    cancha.
                  </p>

                  {/* Formulario Agregar Botón */}
                  <form
                    onSubmit={agregarNuevoBoton}
                    style={{
                      display: "flex",
                      gap: "6px",
                      marginBottom: "12px",
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <input
                      type="text"
                      value={nuevoBtnNombre}
                      onChange={(e) => setNuevoBtnNombre(e.target.value)}
                      placeholder="Ej: Bloqueos"
                      style={{ ...estiloInput, flex: 2 } as any}
                    />
                    <select
                      value={nuevoBtnColor}
                      onChange={(e) => setNuevoBtnColor(e.target.value)}
                      style={{ ...estiloInput, flex: 1.2 } as any}
                    >
                      {PALETA_COLORES.map((c) => (
                        <option key={c.hex} value={c.hex}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      style={{
                        padding: "10px 14px",
                        backgroundColor: "#10b981",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        fontWeight: "bold",
                        cursor: "pointer",
                        fontSize: "13px",
                      }}
                    >
                      ➕ Sumar
                    </button>
                  </form>

                  {/* Lista de Botones para Ordenar y Pintar */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      maxHeight: "200px",
                      overflowY: "auto",
                    }}
                  >
                    {botonesDinamicos.map((btn, idx) => (
                      <div
                        key={btn.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          backgroundColor: "#1f2937",
                          padding: "6px 10px",
                          borderRadius: "6px",
                          borderLeft: `5px solid ${btn.color}`,
                        }}
                      >
                        <span style={{ fontSize: "13px", fontWeight: "bold" }}>
                          {btn.nombre}
                        </span>
                        <div style={{ display: "flex", gap: "4px" }}>
                          <button
                            type="button"
                            onClick={() => moverOrdenBoton(idx, "subir")}
                            disabled={idx === 0}
                            style={{
                              padding: "4px 6px",
                              backgroundColor: "#374151",
                              border: "none",
                              color: "white",
                              borderRadius: "4px",
                              cursor: "pointer",
                              fontSize: "11px",
                            }}
                          >
                            🔼
                          </button>
                          <button
                            type="button"
                            onClick={() => moverOrdenBoton(idx, "bajar")}
                            disabled={idx === botonesDinamicos.length - 1}
                            style={{
                              padding: "4px 6px",
                              backgroundColor: "#374151",
                              border: "none",
                              color: "white",
                              borderRadius: "4px",
                              cursor: "pointer",
                              fontSize: "11px",
                            }}
                          >
                            🔽
                          </button>
                          <button
                            type="button"
                            onClick={() => eliminarBotonDinamico(btn.id)}
                            style={{
                              padding: "4px 8px",
                              backgroundColor: "#7f1d1d",
                              border: "none",
                              color: "#f87171",
                              borderRadius: "4px",
                              cursor: "pointer",
                              fontWeight: "bold",
                              fontSize: "11px",
                            }}
                          >
                            ❌
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Carga de jugadoras */}
              {listaEquipos.length > 0 && (
                <>
                  <form
                    onSubmit={agregarJugadorasAlEquipo}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <label style={{ fontSize: "13px", color: "#94a3b8" }}>
                      Jugadoras de (
                      <b>
                        {
                          listaEquipos.find((e) => e.id === equipoSeleccionado)
                            ?.nombre
                        }
                      </b>
                      ):
                    </label>
                    <textarea
                      value={nuevasJugadorasTexto}
                      onChange={(e) => setNuevasJugadorasTexto(e.target.value)}
                      placeholder="Delfina, Belen, Sofia"
                      rows={2}
                      style={estiloInput as any}
                    />
                    <button
                      type="submit"
                      style={{
                        padding: "10px",
                        backgroundColor: "#2563eb",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        fontWeight: "bold",
                        cursor: "pointer",
                      }}
                    >
                      ➕ Cargar Jugadoras
                    </button>
                  </form>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "6px",
                      maxHeight: "100px",
                      overflowY: "auto",
                      backgroundColor: "#111827",
                      padding: "6px",
                      borderRadius: "6px",
                    }}
                  >
                    {jugadorasDelEquipo.map((jug) => (
                      <span
                        key={jug}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          backgroundColor: "#374151",
                          padding: "3px 6px",
                          borderRadius: "4px",
                          fontSize: "11px",
                        }}
                      >
                        {jug}{" "}
                        <button
                          type="button"
                          onClick={() => eliminarJugadoraIndividual(jug)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#ef4444",
                            cursor: "pointer",
                            padding: 0,
                          }}
                        >
                          ❌
                        </button>
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* CONFIGURACIÓN DEL PARTIDO */}
          <div
            style={{
              backgroundColor: "#1f2937",
              padding: "24px",
              borderRadius: "12px",
              border: "1px solid #374151",
            }}
          >
            <h2
              style={{
                textAlign: "center",
                color: "#60a5fa",
                marginTop: 0,
                marginBottom: "16px",
              }}
            >
              🏑 NUEVO PARTIDO
            </h2>
            <form
              onSubmit={comenzarPartidoEnBaseDeDatos}
              style={{ display: "flex", flexDirection: "column", gap: "14px" }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "4px",
                    fontSize: "14px",
                    fontWeight: "bold",
                  }}
                >
                  Categoría a Dirigir:
                </label>
                <select
                  value={equipoSeleccionado}
                  onChange={(e) => manejarCambioEquipo(e.target.value)}
                  style={estiloInput as any}
                >
                  {listaEquipos.length === 0 && (
                    <option>No tenés categorías autorizadas.</option>
                  )}
                  {listaEquipos.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {listaEquipos.length > 0 && (
                <>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "10px",
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: "block",
                          marginBottom: "4px",
                          fontSize: "14px",
                        }}
                      >
                        Rival:
                      </label>
                      <input
                        type="text"
                        value={rival}
                        onChange={(e) => setRival(e.target.value)}
                        placeholder="Ej: Rowing"
                        style={estiloInput as any}
                        required
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          display: "block",
                          marginBottom: "4px",
                          fontSize: "14px",
                        }}
                      >
                        Cancha:
                      </label>
                      <input
                        type="text"
                        value={cancha}
                        onChange={(e) => setCancha(e.target.value)}
                        placeholder="Ej: Agua"
                        style={estiloInput as any}
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "4px",
                        fontSize: "14px",
                      }}
                    >
                      Fecha:
                    </label>
                    <input
                      type="date"
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
                      style={estiloInput as any}
                    />
                  </div>

                  <h3
                    style={{
                      borderBottom: "1px solid #374151",
                      paddingBottom: "6px",
                      color: "#9ca3af",
                      marginBottom: "4px",
                      fontSize: "14px",
                    }}
                  >
                    📋 Convocadas ({titulares.length} Tit. / {suplentes.length}{" "}
                    Sup.)
                  </h3>
                  <div
                    style={{
                      maxHeight: "150px",
                      overflowY: "auto",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    {jugadorasDelEquipo.length === 0 ? (
                      <div
                        style={{
                          fontSize: "13px",
                          color: "#9ca3af",
                          textAlign: "center",
                        }}
                      >
                        No hay jugadoras cargadas en este plantel.
                      </div>
                    ) : (
                      jugadorasDelEquipo.map((j) => {
                        const esT = titulares.includes(j);
                        const esS = suplentes.includes(j);
                        return (
                          <div
                            key={j}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              backgroundColor: "#2d3748",
                              padding: "6px 8px",
                              borderRadius: "6px",
                            }}
                          >
                            <span style={{ fontSize: "13px" }}>{j}</span>
                            <div style={{ display: "flex", gap: "4px" }}>
                              <button
                                type="button"
                                onClick={() =>
                                  asignarRol(j, esT ? "ninguno" : "titular")
                                }
                                style={{
                                  padding: "3px 6px",
                                  borderRadius: "4px",
                                  border: "none",
                                  cursor: "pointer",
                                  fontWeight: "bold",
                                  backgroundColor: esT ? "#15803d" : "#4b5563",
                                  color: "white",
                                  fontSize: "11px",
                                }}
                              >
                                Titular
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  asignarRol(j, esS ? "ninguno" : "suplente")
                                }
                                style={{
                                  padding: "3px 6px",
                                  borderRadius: "4px",
                                  border: "none",
                                  cursor: "pointer",
                                  fontWeight: "bold",
                                  backgroundColor: esS ? "#b45309" : "#4b5563",
                                  color: "white",
                                  fontSize: "11px",
                                }}
                              >
                                Suplente
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <button
                    type="submit"
                    style={{
                      marginTop: "6px",
                      padding: "14px",
                      borderRadius: "8px",
                      border: "none",
                      backgroundColor: "#2563eb",
                      color: "white",
                      fontWeight: "bold",
                      fontSize: "16px",
                      cursor: "pointer",
                    }}
                  >
                    🚀 INICIAR ANALISIS EN VIVO
                  </button>
                </>
              )}
            </form>
          </div>
        </div>
      ) : (
        /* ---------------- MODO JUEGO COLABORATIVO ADAPTATIVO ---------------- */
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "10px",
              marginBottom: "16px",
              paddingBottom: "10px",
              borderBottom: "1px solid #374151",
            }}
          >
            <button
              onClick={finalizarPartido}
              style={{
                padding: "8px 14px",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
                fontWeight: "bold",
                backgroundColor: "#dc2626",
                color: "white",
                fontSize: "13px",
              }}
            >
              🚩 Cerrar Mesa
            </button>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setVista("telefono")}
                style={{
                  padding: "8px 16px",
                  borderRadius: "20px",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: "bold",
                  backgroundColor: vista === "telefono" ? "#6366f1" : "#374151",
                  color: "white",
                  fontSize: "13px",
                }}
              >
                📲 Celular
              </button>
              <button
                onClick={() => setVista("computadora")}
                style={{
                  padding: "8px 16px",
                  borderRadius: "20px",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: "bold",
                  backgroundColor:
                    vista === "computadora" ? "#6366f1" : "#374151",
                  color: "white",
                  fontSize: "13px",
                }}
              >
                💻 Computadora
              </button>
            </div>
          </div>

          {/* VISTA MOVIL CON RE-TAMAÑO AUTO (GRID FLEXIBLE) */}
          {vista === "telefono" && (
            <div
              style={{
                maxWidth: "480px",
                margin: "0 auto",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              <div
                style={{
                  backgroundColor: "#1f2937",
                  padding: "12px",
                  borderRadius: "12px",
                  textAlign: "center",
                  border: "1px solid #374151",
                }}
              >
                <div
                  style={{
                    fontSize: "42px",
                    fontFamily: "monospace",
                    fontWeight: "bold",
                    color: "#10b981",
                    marginBottom: "4px",
                  }}
                >
                  {formatearTiempo(segundos)}
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => setCorriendo(!corriendo)}
                    style={{
                      flex: 2,
                      padding: "10px",
                      borderRadius: "8px",
                      border: "none",
                      fontWeight: "bold",
                      cursor: "pointer",
                      backgroundColor: corriendo ? "#e11d48" : "#2563eb",
                      color: "white",
                    }}
                  >
                    {corriendo ? "⏸️ PAUSAR" : "▶️ INICIAR"}
                  </button>
                  <button
                    onClick={() => setSegundos(0)}
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: "8px",
                      border: "none",
                      fontWeight: "bold",
                      cursor: "pointer",
                      backgroundColor: "#4b5563",
                      color: "white",
                    }}
                  >
                    🔄 Reset
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: "6px",
                  backgroundColor: "#1f2937",
                  padding: "6px",
                  borderRadius: "8px",
                }}
              >
                {["1Q", "2Q", "3Q", "4Q"].map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      setCuartoActual(q);
                      setSegundos(0);
                      setCorriendo(false);
                    }}
                    style={{
                      padding: "8px 0",
                      fontWeight: "bold",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      backgroundColor:
                        cuartoActual === q ? "#2563eb" : "#374151",
                      color: "white",
                      fontSize: "12px",
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>

              {/* GRILLA CON ADAPTACIÓN DE TAMAÑO SEGÚN CANTIDAD DE ELEMENTOS */}
              <div
                style={{
                  display: "grid",
                  // Si hay pocos botones se hacen más grandes, si hay muchos se organizan solos en columnas equilibradas
                  gridTemplateColumns:
                    botonesDinamicos.length <= 4 ? "1fr" : "1fr 1fr",
                  gap: "12px",
                  width: "100%",
                }}
              >
                {botonesDinamicos.map((btn) => (
                  <ComponenteBotonDinamico key={btn.id} objetoBoton={btn} />
                ))}
              </div>
              <p
                style={{
                  textTransform: "uppercase",
                  fontSize: "10px",
                  textAlign: "center",
                  color: "#94a3b8",
                  margin: "4px 0 0 0",
                }}
              >
                💡 Tip: Mantené presionado cualquier botón para restar un evento
                por error.
              </p>
            </div>
          )}

          {/* VISTA ESCRITORIO O AUDITORÍA */}
          {vista === "computadora" && (
            <div style={{ maxWidth: "950px", margin: "0 auto" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginBottom: "12px",
                }}
              >
                <button
                  onClick={() => exportarAExcel(null)}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#16a34a",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  📥 Exportar Planilla (.xlsx)
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: "10px",
                  backgroundColor: "#1f2937",
                  padding: "14px",
                  borderRadius: "8px",
                  marginBottom: "14px",
                  fontSize: "13px",
                }}
              >
                <div>
                  <strong>Club:</strong> Talleres de Paraná
                </div>
                <div>
                  <strong>Rival:</strong> {rival}
                </div>
                <div>
                  <strong>Fecha:</strong> {fecha}
                </div>
                <div>
                  <strong>Cancha:</strong> {cancha || "No definida"}
                </div>
              </div>

              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  backgroundColor: "#1f2937",
                  fontSize: "14px",
                }}
              >
                <thead>
                  <tr>
                    <th style={estiloCeldaTh as any}>
                      Métrica / Evento Personalizado
                    </th>
                    <th style={estiloCeldaTh as any}>1° Cuarto</th>
                    <th style={estiloCeldaTh as any}>2° Cuarto</th>
                    <th style={estiloCeldaTh as any}>3° Cuarto</th>
                    <th style={estiloCeldaTh as any}>4° Cuarto</th>
                    <th
                      style={
                        { ...estiloCeldaTh, backgroundColor: "#2563eb" } as any
                      }
                    >
                      TOTAL
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {botonesDinamicos.map((btn) => (
                    <tr key={btn.id}>
                      <td
                        style={
                          {
                            ...estiloCeldaTd,
                            textAlign: "left",
                            fontWeight: "bold",
                            borderLeft: `5px solid ${btn.color}`,
                          } as any
                        }
                      >
                        {btn.nombre}
                      </td>
                      <td style={estiloCeldaTd as any}>
                        {estadisticas["1Q"]?.[btn.id] || 0}
                      </td>
                      <td style={estiloCeldaTd as any}>
                        {estadisticas["2Q"]?.[btn.id] || 0}
                      </td>
                      <td style={estiloCeldaTd as any}>
                        {estadisticas["3Q"]?.[btn.id] || 0}
                      </td>
                      <td style={estiloCeldaTd as any}>
                        {estadisticas["4Q"]?.[btn.id] || 0}
                      </td>
                      <td
                        style={
                          {
                            ...estiloCeldaTd,
                            fontWeight: "bold",
                            backgroundColor: "#1e3a8a",
                          } as any
                        }
                      >
                        {calcularTotal(btn.id)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
