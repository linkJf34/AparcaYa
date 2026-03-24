package com.exe.AparcaYA.Repository;

import com.exe.AparcaYA.Entity.Sede;
import com.exe.AparcaYA.Entity.Tarifa;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
@Repository
public interface TarifaRepository extends JpaRepository<Tarifa, Long> {

    List<Tarifa> findBySede_IdSede(Long idSede);

    // NUEVO — necesario para TarifaService.findBySede()
    List<Tarifa> findBySede(Sede sede);


}