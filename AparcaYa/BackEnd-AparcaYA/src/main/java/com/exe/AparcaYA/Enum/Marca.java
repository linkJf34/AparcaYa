package com.exe.AparcaYA.Enum;

public enum Marca {
    // CARROS
    RENAULT("CARRO"),
    KIA("CARRO"),
    TOYOTA("CARRO"),
    CHEVROLET("CARRO"),
    MAZDA("CARRO"),
    NISSAN("CARRO"),
    VOLKSWAGEN("CARRO"),
    FORD("CARRO"),
    HYUNDAI("CARRO"),
    BMW("CARRO"),
    MERCEDES_BENZ("CARRO"),
    AUDI("CARRO"),
    PEUGEOT("CARRO"),
    CITROEN("CARRO"),
    FIAT("CARRO"),
    VOLVO("CARRO"),
    JEEP("CARRO"),
    LAND_ROVER("CARRO"),
    PORSCHE("CARRO"),
    FERRARI("CARRO"),
    LAMBORGHINI("CARRO"),
    TESLA("CARRO"),
    BYD("CARRO"),
    CHANGAN("CARRO"),
    GEELY("CARRO"),
    JAC("CARRO"),
    CHERY("CARRO"),
    GREAT_WALL("CARRO"),
    HAVAL("CARRO"),
    GWM("CARRO"),
    MITSUBISHI("CARRO"),
    SUBARU("CARRO"),
    ISUZU("CARRO"),
    SSANGYONG("CARRO"),
    MG("CARRO"),
    RAM("CARRO"),
    DFSK("CARRO"),
    FOTON("CARRO"),

    // MOTOS
    HONDA("MOTO"),
    YAMAHA("MOTO"),
    SUZUKI("MOTO"),
    KAWASAKI("MOTO"),
    BAJAJ("MOTO"),
    TVS("MOTO"),
    HERO("MOTO"),
    KTM("MOTO"),
    DUCATI("MOTO"),
    HARLEY_DAVIDSON("MOTO"),
    BMW_MOTORRAD("MOTO"),
    TRIUMPH("MOTO"),
    ROYAL_ENFIELD("MOTO"),
    AUTECO("MOTO"),
    AKT("MOTO"),
    VICTORY("MOTO"),
    APRILIA("MOTO"),
    BENELLI("MOTO"),
    HUSQVARNA("MOTO"),

    // BICICLETAS
    TREK("BICICLETA"),
    SPECIALIZED("BICICLETA"),
    GIANT("BICICLETA"),
    SCOTT("BICICLETA"),
    CANNONDALE("BICICLETA"),
    ORBEA("BICICLETA"),
    GW("BICICLETA"),
    SHIMANO("BICICLETA"),
    BIANCHI("BICICLETA"),
    MERIDA("BICICLETA"),
    CUBE("BICICLETA"),
    TREK_BICI("BICICLETA"),
    BMC("BICICLETA"),
    FOCUS("BICICLETA"),

    // OTROS
    OTRO("OTRO");

    private final String tipoVehiculo;

    Marca(String tipoVehiculo) {
        this.tipoVehiculo = tipoVehiculo;
    }

    public String getTipoVehiculo() {
        return tipoVehiculo;
    }

    // Método estático para obtener marcas por tipo de vehículo
    public static Marca[] getMarcasPorTipo(String tipo) {
        return java.util.Arrays.stream(values())
                .filter(marca -> marca.getTipoVehiculo().equals(tipo))
                .toArray(Marca[]::new);
    }
}