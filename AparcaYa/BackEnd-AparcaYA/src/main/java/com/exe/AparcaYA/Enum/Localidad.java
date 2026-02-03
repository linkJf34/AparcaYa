package com.exe.AparcaYA.Enum;

public enum Localidad {

    USAQUEN(new String[]{
            "Santa Bárbara", "Cedritos", "Usaquén", "La Calleja", "Molinos Norte","Barrancas"
    }),

    CHAPINERO(new String[]{
            "Chicó", "El Lago", "Rosales", "Chapinero Alto", "Antiguo Country"
    }),

    SANTA_FE(new String[]{
            "Las Aguas", "La Perseverancia", "San Diego"
    }),

    SAN_CRISTOBAL(new String[]{
            "San Cristóbal Norte", "San Blas", "La Victoria"
    }),

    USME(new String[]{
            "Usme Pueblo", "Yomasa", "El Virrey"
    }),

    TUNJUELITO(new String[]{
            "Parque El Tunal", "San Vicente", "Venecia"
    }),

    BOSA(new String[]{
            "Bosa Central", "Bosa Laureles", "El Porvenir"
    }),

    KENNEDY(new String[]{
            "Tintal", "Timiza", "Mandalay", "Carvajal", "Patio Bonito"
    }),

    FONTIBON(new String[]{
            "Capellanía", "Fontibón Centro", "Modelia"
    }),

    ENGATIVA(new String[]{
            "Ferias", "Boyacá Real", "Minuto de Dios"
    }),

    SUBA(new String[]{
            "Tibabuyes", "Niza", "Suba Centro", "La Campiña"
    }),

    BARRIOS_UNIDOS(new String[]{
            "7 de Agosto", "Doce de Octubre", "San Felipe"
    }),

    TEUSAQUILLO(new String[]{
            "La Soledad", "Quesada", "Campín"
    }),

    MARTIRES(new String[]{
            "Santa Isabel", "Eduardo Santos"
    }),

    ANTONIO_NARINO(new String[]{
            "Restrepo", "Eduardo Santos", "Policarpa"
    }),

    PUENTE_ARANDA(new String[]{
            "Ciudad Montes", "Torremolinos", "Salazar Gómez"
    }),

    CANDELARIA(new String[]{
            "La Catedral", "Egipto", "Las Aguas"
    }),

    RAFAEL_URIBE_URIBE(new String[]{
            "Bravo Páez", "Marruecos", "Quiroga"
    }),

    CIUDAD_BOLIVAR(new String[]{
            "Meissen", "Jerusalén", "Paraíso"
    }),

    SUMAPAZ(new String[]{
            "Nazareth", "Betania"
    });

    private final String[] barrios;

    Localidad(String[] barrios) {
        this.barrios = barrios;
    }

    public String[] getBarrios() {
        return barrios;
    }
}