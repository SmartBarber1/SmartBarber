import {
    Routes
} from '@angular/router';

import {
    authGuard
} from '../../core/auth/guards/auth.guard';

import {
    roleGuard
} from '../../core/auth/guards/role.guard';





import {
    EmployeeRepository
} from '../employee/domain/repositories/employee.repository';

import {
    EmployeeApiService
} from '../employee/infrastructure/api/employee-api.service';

import {
    CreateEmployeeUseCase
} from '../employee/application/use-cases/create-employee.use-case';
import {
    GetTeamUseCase
} from '../employee/application/use-cases/get-team.use-case';
import {
    ChangeEmployeeAccessUseCase
} from '../employee/application/use-cases/change-employee-access.use-case';
import {
    SearchEmployeeUseCase
} from '../employee/application/use-cases/search-employee.use-case';
import {
    UpdateEmployeeUseCase
} from '../employee/application/use-cases/update-employee.use-case';


export const USER_MANAGEMENT_ROUTES:
    Routes = [

        {
            path: '',

            canActivate: [
                authGuard,
                roleGuard
            ],

            data: {
                roles: ['ADMIN']
            },

            providers: [

                {
                    provide:
                        EmployeeRepository,

                    useClass:
                        EmployeeApiService
                },

                CreateEmployeeUseCase,
                GetTeamUseCase,
                ChangeEmployeeAccessUseCase,
                SearchEmployeeUseCase,
                UpdateEmployeeUseCase
            ],

            loadComponent: () =>
                import(
                    './pages/user-management/user-management.component'
                ).then(
                    m =>
                        m.UserManagementComponent
                )
        }
    ];