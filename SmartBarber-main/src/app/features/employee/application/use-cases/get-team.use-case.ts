import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { EmployeeRepository } from '../../domain/repositories/employee.repository';
import { TeamMember } from '../../domain/models/team-member.model';

/** Equipo de la barbería del administrador, con el estado de cada cuenta (ordenado por nombre en el backend). */
@Injectable()
export class GetTeamUseCase {

    private readonly employeeRepository =
        inject(EmployeeRepository);

    execute(): Observable<TeamMember[]> {
        return this.employeeRepository.getTeam();
    }
}
